import {
  getInventoryStatus,
  insertMobileOrderWithGeneratedNumber,
  loadOrderedQuantityByProductForSchedule,
  loadScheduleInventoryState,
  resolveActiveSchedule,
} from '@/lib/mobile-order'
import { applyStorePosSettingsToStore } from '@/lib/store-pos-settings'
import type {
  MobileOrderOptionChoiceRow,
  MobileOrderOptionGroupRow,
  MobileOrderProductRow,
  PublicMobileOrderCreatePayload,
  StoreOrderScheduleRow,
  StorePosCreatePayload,
  VendorStoreRow,
} from '@/types/api-payloads'

type ProductOptionLink = {
  product_id: string
  option_group_id: string
}

type OrderPageRecord = {
  id: string
  public_token: string
  status: string
  notes?: string | null
}

export type PreparedMobileOrderItem = {
  product: MobileOrderProductRow
  quantity: number
  lineTotal: number
  selectedChoicesByGroup: Map<string, MobileOrderOptionChoiceRow[]>
}

export type PreparedMobileOrderDraft = {
  store: VendorStoreRow
  orderPage: OrderPageRecord
  activeSchedule: StoreOrderScheduleRow
  pickupNickname: string
  customerLineUserId: string | null
  customerLineDisplayName: string | null
  subtotalAmount: number
  normalizedItems: PreparedMobileOrderItem[]
  optionGroupMap: Map<string, MobileOrderOptionGroupRow>
}

function normalizeCreatePayload(body: PublicMobileOrderCreatePayload | StorePosCreatePayload) {
  const publicToken = String(body.public_token ?? '').trim()
  const pickupNickname = String(body.pickup_nickname ?? '').trim()
  const customerLineUserId =
    'customer_line_user_id' in body ? String(body.customer_line_user_id ?? '').trim() || null : null
  const customerLineDisplayName =
    'customer_line_display_name' in body ? String(body.customer_line_display_name ?? '').trim() || null : null
  const items = Array.isArray(body.items) ? body.items : []

  return {
    publicToken,
    pickupNickname,
    customerLineUserId,
    customerLineDisplayName,
    items,
  }
}

export async function preparePublicOrderDraft(
  supabase: any,
  body: PublicMobileOrderCreatePayload | StorePosCreatePayload
): Promise<PreparedMobileOrderDraft> {
  const { publicToken, pickupNickname, customerLineUserId, customerLineDisplayName, items } =
    normalizeCreatePayload(body)

  if (!publicToken) throw new Error('注文ページ情報が不足しています')
  if (!pickupNickname) throw new Error('受け取りニックネームを入力してください')
  if (items.length === 0) throw new Error('商品を1件以上追加してください')

  const { data: orderPage, error: pageError } = await (supabase as any)
    .from('store_order_pages')
    .select('id, public_token, status, notes, vendor_stores!inner(*)')
    .eq('public_token', publicToken)
    .eq('status', 'published')
    .maybeSingle()

  if (pageError) throw new Error(pageError.message)
  if (!orderPage?.vendor_stores) throw new Error('注文ページが見つかりません')

  const store = applyStorePosSettingsToStore(orderPage.vendor_stores as VendorStoreRow, orderPage)

  const { data: schedules, error: schedulesError } = await (supabase as any)
    .from('store_order_schedules')
    .select('*')
    .eq('order_page_id', orderPage.id)
    .order('opens_at', { ascending: true })

  if (schedulesError) throw new Error(schedulesError.message)

  const activeSchedule = resolveActiveSchedule((schedules ?? []) as StoreOrderScheduleRow[])
  if (!activeSchedule) throw new Error('現在は注文受付時間外です')

  const orderedQuantityByProduct = await loadOrderedQuantityByProductForSchedule(supabase, activeSchedule.id)
  const productIds = Array.from(new Set(items.map((item) => String(item.product_id))))
  const choiceIds = Array.from(
    new Set(
      items.flatMap((item) =>
        Array.isArray(item.selected_option_choice_ids) ? item.selected_option_choice_ids.map((id) => String(id)) : []
      )
    )
  )

  const [
    { data: products, error: productsError },
    { data: optionGroups, error: groupsError },
    { data: optionChoices, error: choicesError },
    { data: links, error: linksError },
  ] = await Promise.all([
    (supabase as any).from('mobile_order_products').select('*').in('id', productIds),
    (supabase as any).from('mobile_order_option_groups').select('*').eq('store_id', store.id),
    choiceIds.length > 0
      ? (supabase as any).from('mobile_order_option_choices').select('*').in('id', choiceIds)
      : Promise.resolve({ data: [], error: null }),
    (supabase as any)
      .from('mobile_order_product_option_groups')
      .select('product_id, option_group_id')
      .in('product_id', productIds),
  ])

  if (productsError) throw new Error(productsError.message)
  if (groupsError) throw new Error(groupsError.message)
  if (choicesError) throw new Error(choicesError.message)
  if (linksError) throw new Error(linksError.message)

  const productMap = new Map(((products ?? []) as MobileOrderProductRow[]).map((product) => [product.id, product]))
  const optionGroupMap = new Map(
    ((optionGroups ?? []) as MobileOrderOptionGroupRow[]).map((group) => [group.id, group])
  )
  const optionChoiceMap = new Map(
    ((optionChoices ?? []) as MobileOrderOptionChoiceRow[]).map((choice) => [choice.id, choice])
  )
  const { inventoryByProduct, adjustmentsByProduct } = await loadScheduleInventoryState(
    supabase,
    activeSchedule.id,
    productIds
  )
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

  return {
    store,
    orderPage: {
      id: orderPage.id,
      public_token: orderPage.public_token,
      status: orderPage.status,
      notes: orderPage.notes ?? null,
    },
    activeSchedule,
    pickupNickname,
    customerLineUserId,
    customerLineDisplayName,
    subtotalAmount,
    normalizedItems,
    optionGroupMap,
  }
}

export async function insertPreparedOrderItems(
  supabase: any,
  orderId: string,
  normalizedItems: PreparedMobileOrderItem[],
  optionGroupMap: Map<string, MobileOrderOptionGroupRow>
) {
  for (const item of normalizedItems) {
    const { data: insertedItem, error: itemError } = await (supabase as any)
      .from('mobile_order_items')
      .insert([
        {
          order_id: orderId,
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
  }
}

export async function createPreparedMobileOrder(
  supabase: any,
  draft: PreparedMobileOrderDraft,
  overrides?: Partial<{
    payment_status: 'pending' | 'authorized' | 'paid' | 'failed' | 'refunded'
    payment_provider: string
    payment_reference: string | null
  }>
) {
  const order = await insertMobileOrderWithGeneratedNumber(
    supabase,
    {
      id: draft.store.id,
      store_code: draft.store.store_code,
    },
    draft.activeSchedule.business_date,
    {
      store_id: draft.store.id,
      order_page_id: draft.orderPage.id,
      schedule_id: draft.activeSchedule.id,
      customer_line_user_id: draft.customerLineUserId,
      customer_line_display_name: draft.customerLineDisplayName,
      pickup_nickname: draft.pickupNickname,
      status: 'placed',
      payment_status: overrides?.payment_status ?? 'pending',
      payment_provider: overrides?.payment_provider ?? 'stripe_checkout',
      payment_reference: overrides?.payment_reference ?? null,
      subtotal_amount: draft.subtotalAmount,
      tax_amount: 0,
      total_amount: draft.subtotalAmount,
    }
  )

  try {
    await insertPreparedOrderItems(supabase, order.id, draft.normalizedItems, draft.optionGroupMap)
    return order
  } catch (error) {
    await (supabase as any).from('mobile_orders').delete().eq('id', order.id)
    throw error
  }
}
