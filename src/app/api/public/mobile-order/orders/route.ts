import { NextRequest } from 'next/server'
import { apiError, apiOk } from '@/lib/api-response'
import {
  getInventoryStatus,
  insertMobileOrderWithGeneratedNumber,
  loadOrderedQuantityByProductForSchedule,
  loadScheduleInventoryState,
  resolveActiveSchedule,
} from '@/lib/mobile-order'
import { getStripeClient, getStripeConfigStatus } from '@/lib/stripe'
import { createServerSupabaseClient } from '@/lib/supabase'
import type {
  MobileOrderOptionChoiceRow,
  MobileOrderOptionGroupRow,
  MobileOrderProductRow,
  PublicMobileOrderCheckoutResponse,
  PublicMobileOrderCreatePayload,
  StoreOrderScheduleRow,
} from '@/types/api-payloads'

type ProductOptionLink = {
  product_id: string
  option_group_id: string
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient()

  try {
    const stripeConfig = getStripeConfigStatus()
    if (!stripeConfig.hasSecretKey) {
      return apiError('現在クレジットカード決済の設定中です。少し時間をおいてお試しください。', 503)
    }

    const body = (await req.json()) as PublicMobileOrderCreatePayload
    const publicToken = String(body.public_token ?? '').trim()
    const pickupNickname = String(body.pickup_nickname ?? '').trim()
    const customerLineUserId = String(body.customer_line_user_id ?? '').trim() || null
    const customerLineDisplayName = String(body.customer_line_display_name ?? '').trim() || null
    const items = Array.isArray(body.items) ? body.items : []

    if (!publicToken) return apiError('注文ページ情報が不足しています', 400)
    if (!pickupNickname) return apiError('受け取りニックネームを入力してください', 400)
    if (items.length === 0) return apiError('商品を1件以上追加してください', 400)

    const { data: orderPage, error: pageError } = await (supabase as any)
      .from('store_order_pages')
      .select('*, vendor_stores!inner(*)')
      .eq('public_token', publicToken)
      .eq('status', 'published')
      .maybeSingle()

    if (pageError) return apiError(pageError.message)
    if (!orderPage?.vendor_stores) return apiError('注文ページが見つかりません', 404)

    const store = orderPage.vendor_stores

    const { data: schedules, error: schedulesError } = await (supabase as any)
      .from('store_order_schedules')
      .select('*')
      .eq('order_page_id', orderPage.id)
      .order('opens_at', { ascending: true })

    if (schedulesError) return apiError(schedulesError.message)

    const activeSchedule = resolveActiveSchedule((schedules ?? []) as StoreOrderScheduleRow[])
    if (!activeSchedule) return apiError('現在は注文受付時間外です', 409)
    const orderedQuantityByProduct = await loadOrderedQuantityByProductForSchedule(supabase, activeSchedule.id)

    const productIds = Array.from(new Set(items.map((item) => String(item.product_id))))
    const choiceIds = Array.from(
      new Set(
        items.flatMap((item) =>
          Array.isArray(item.selected_option_choice_ids) ? item.selected_option_choice_ids.map((id) => String(id)) : []
        )
      )
    )

    const [{ data: products, error: productsError }, { data: optionGroups, error: groupsError }, { data: optionChoices, error: choicesError }, { data: links, error: linksError }] =
      await Promise.all([
        (supabase as any).from('mobile_order_products').select('*').in('id', productIds),
        (supabase as any).from('mobile_order_option_groups').select('*').eq('store_id', store.id),
        choiceIds.length > 0
          ? (supabase as any).from('mobile_order_option_choices').select('*').in('id', choiceIds)
          : Promise.resolve({ data: [], error: null }),
        (supabase as any).from('mobile_order_product_option_groups').select('product_id, option_group_id').in('product_id', productIds),
      ])

    if (productsError) return apiError(productsError.message)
    if (groupsError) return apiError(groupsError.message)
    if (choicesError) return apiError(choicesError.message)
    if (linksError) return apiError(linksError.message)

    const productMap = new Map(((products ?? []) as MobileOrderProductRow[]).map((product) => [product.id, product]))
    const optionGroupMap = new Map(((optionGroups ?? []) as MobileOrderOptionGroupRow[]).map((group) => [group.id, group]))
    const optionChoiceMap = new Map(((optionChoices ?? []) as MobileOrderOptionChoiceRow[]).map((choice) => [choice.id, choice]))
    const { inventoryByProduct, adjustmentsByProduct } = await loadScheduleInventoryState(supabase, activeSchedule.id, productIds)
    const allowedGroupIdsByProduct = new Map<string, string[]>()

    for (const link of (links ?? []) as ProductOptionLink[]) {
      const current = allowedGroupIdsByProduct.get(link.product_id) ?? []
      current.push(link.option_group_id)
      allowedGroupIdsByProduct.set(link.product_id, current)
    }

    let subtotalAmount = 0
    const requestedQuantityByProduct = new Map<string, number>()
    const normalizedItems = items.map((item) => {
      const product = productMap.get(String(item.product_id))
      if (!product || product.store_id !== store.id || !product.is_published || product.is_sold_out) {
        throw new Error('注文できない商品が含まれています')
      }

      const quantity = Number(item.quantity)
      if (!Number.isInteger(quantity) || quantity < 1) {
        throw new Error('数量は1以上の整数で入力してください')
      }

      const currentInventory = inventoryByProduct.get(product.id) ?? null
      const currentAdjustments = adjustmentsByProduct.get(product.id) ?? []
      const adjustmentTotal = currentAdjustments.reduce(
        (sum, adjustment) => sum + Number(adjustment.adjustment_quantity ?? 0),
        0
      )
      const inventory = getInventoryStatus({
        tracks_inventory: product.tracks_inventory,
        initial_quantity: currentInventory?.initial_quantity ?? null,
        adjustment_total: adjustmentTotal,
        low_stock_threshold: product.low_stock_threshold,
        ordered_quantity: orderedQuantityByProduct.get(product.id) ?? 0,
        is_sold_out: product.is_sold_out,
      })

      if (inventory.status === 'not_set') {
        throw new Error(`${product.name} は本日の在庫設定がまだ完了していません`)
      }
      if (inventory.status === 'sold_out') {
        throw new Error(`${product.name} は売り切れです`)
      }
      const nextRequestedQuantity = (requestedQuantityByProduct.get(product.id) ?? 0) + quantity
      requestedQuantityByProduct.set(product.id, nextRequestedQuantity)
      if (inventory.remainingQuantity != null && nextRequestedQuantity > inventory.remainingQuantity) {
        throw new Error(`${product.name} の在庫が不足しています`)
      }

      const selectedChoiceIds = Array.isArray(item.selected_option_choice_ids)
        ? item.selected_option_choice_ids.map((id) => String(id))
        : []
      const selectedChoices = selectedChoiceIds.map((choiceId) => {
        const choice = optionChoiceMap.get(choiceId)
        if (!choice || !choice.is_active) {
          throw new Error('選択できないオプションが含まれています')
        }
        return choice
      })

      const selectedChoicesByGroup = new Map<string, MobileOrderOptionChoiceRow[]>()
      for (const choice of selectedChoices) {
        const current = selectedChoicesByGroup.get(choice.group_id) ?? []
        current.push(choice)
        selectedChoicesByGroup.set(choice.group_id, current)
      }

      const allowedGroupIds = allowedGroupIdsByProduct.get(product.id) ?? []
      for (const [groupId] of Array.from(selectedChoicesByGroup.entries())) {
        if (!allowedGroupIds.includes(groupId)) {
          throw new Error('商品に紐づかないオプションが含まれています')
        }
      }

      for (const groupId of allowedGroupIds) {
        const group = optionGroupMap.get(groupId)
        if (!group) continue

        const selectedInGroup = selectedChoicesByGroup.get(groupId) ?? []

        if (group.is_required && selectedInGroup.length === 0) {
          throw new Error(`${group.name} を選択してください`)
        }
        if (group.selection_type === 'single' && selectedInGroup.length > 1) {
          throw new Error(`${group.name} は1つだけ選択できます`)
        }
        if (group.min_select != null && selectedInGroup.length < group.min_select) {
          throw new Error(`${group.name} は ${group.min_select} 件以上選択してください`)
        }
        if (group.max_select != null && selectedInGroup.length > group.max_select) {
          throw new Error(`${group.name} は ${group.max_select} 件まで選択できます`)
        }
      }

      const optionTotal = selectedChoices.reduce((sum, choice) => sum + choice.price_delta, 0)
      const lineTotal = (product.price + optionTotal) * quantity
      subtotalAmount += lineTotal

      return {
        product,
        quantity,
        lineTotal,
        selectedChoicesByGroup,
      }
    })

    const order = await insertMobileOrderWithGeneratedNumber(
      supabase,
      {
        id: store.id,
        store_code: store.store_code,
      },
      activeSchedule.id,
      {
        store_id: store.id,
        order_page_id: orderPage.id,
        schedule_id: activeSchedule.id,
        customer_line_user_id: customerLineUserId,
        customer_line_display_name: customerLineDisplayName,
        pickup_nickname: pickupNickname,
        status: 'placed',
        payment_status: 'pending',
        payment_provider: 'stripe_checkout',
        subtotal_amount: subtotalAmount,
        tax_amount: 0,
        total_amount: subtotalAmount,
      }
    )

    let checkoutUrl = ''

    try {
      const stripeLineItems: Array<{
        price_data: {
          currency: 'jpy'
          unit_amount: number
          product_data: {
            name: string
            description?: string
          }
        }
        quantity: number
      }> = []

      for (const item of normalizedItems) {
        const { data: insertedItem, error: itemError } = await (supabase as any)
          .from('mobile_order_items')
          .insert([
            {
              order_id: order.id,
              product_id: item.product.id,
              product_name_snapshot: item.product.name,
              unit_price_snapshot: item.product.price,
              quantity: item.quantity,
              line_total_amount: item.lineTotal,
            },
          ])
          .select('*')
          .single()

        if (itemError) {
          throw new Error(itemError.message)
        }

        const optionChoiceRows = Array.from(item.selectedChoicesByGroup.entries()).flatMap(([groupId, choices]) => {
          const group = optionGroupMap.get(groupId)
          if (!group) return []

          return choices.map((choice) => ({
            order_item_id: insertedItem.id,
            option_group_name_snapshot: group.name,
            option_choice_name_snapshot: choice.name,
            price_delta_snapshot: choice.price_delta,
          }))
        })

        if (optionChoiceRows.length > 0) {
          const { error: optionInsertError } = await (supabase as any)
            .from('mobile_order_item_option_choices')
            .insert(optionChoiceRows)

          if (optionInsertError) {
            throw new Error(optionInsertError.message)
          }
        }

        const optionDescription = Array.from(item.selectedChoicesByGroup.entries())
          .map(([groupId, choices]) => {
            const group = optionGroupMap.get(groupId)
            if (!group || choices.length === 0) return null
            return `${group.name}: ${choices.map((choice) => choice.name).join(' / ')}`
          })
          .filter(Boolean)
          .join(' | ')

        const unitAmount = Math.round(item.lineTotal / item.quantity)
        stripeLineItems.push({
          price_data: {
            currency: 'jpy',
            unit_amount: unitAmount,
            product_data: {
              name: item.product.name,
              ...(optionDescription ? { description: optionDescription } : {}),
            },
          },
          quantity: item.quantity,
        })
      }

      const stripe = getStripeClient()
      const successUrl = `${req.nextUrl.origin}/order/${publicToken}?checkout_session_id={CHECKOUT_SESSION_ID}&order_id=${order.id}`
      const cancelUrl = `${req.nextUrl.origin}/order/${publicToken}?checkout_cancelled=1`
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: stripeLineItems,
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          order_id: order.id,
          public_token: publicToken,
          store_id: store.id,
          schedule_id: activeSchedule.id,
        },
        payment_intent_data: {
          metadata: {
            order_id: order.id,
            public_token: publicToken,
          },
        },
      })

      if (!session.url) {
        throw new Error('決済ページURLの生成に失敗しました')
      }
      checkoutUrl = session.url

      const { error: paymentReferenceUpdateError } = await (supabase as any)
        .from('mobile_orders')
        .update({
          payment_reference: session.id,
        })
        .eq('id', order.id)

      if (paymentReferenceUpdateError) {
        throw new Error(paymentReferenceUpdateError.message)
      }
    } catch (nestedError) {
      await (supabase as any).from('mobile_orders').delete().eq('id', order.id)
      throw nestedError
    }

    const payload: PublicMobileOrderCheckoutResponse = {
      order_id: order.id,
      checkout_url: checkoutUrl,
    }

    return apiOk(payload)
  } catch (error) {
    console.error('[public/mobile-order/orders POST]', error)
    return apiError(error instanceof Error ? error.message : 'サーバーエラー')
  }
}
