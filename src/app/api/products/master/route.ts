import { NextRequest } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import {
  loadPrimaryStoreOrderPageForVendor,
  loadProductMasterCostContext,
  resolveLinkedProductMaster,
  upsertProductMasterLinksInNotes,
  type MobileOrderProductMasterLink,
  type ProductMasterLinkMode,
} from '@/lib/product-master-links'
import type {
  MutationSuccessPayload,
  ProductMasterLinkMode as ProductMasterLinkModePayload,
  ProductMasterListPayload,
  ProductMasterMobileOrderLinkPayload,
  ProductMasterMobileOrderOptionChoiceLinkPayload,
  ProductMasterRecordPayload,
} from '@/types/api-payloads'
import type { Database } from '@/types/database'

type ProductMasterRow = Database['public']['Tables']['product_master']['Row']

function normalizeCostPayload(body: Record<string, unknown>) {
  const hasAmount = body.cost_amount != null && body.cost_amount !== ''
  const hasRate = body.cost_rate != null && body.cost_rate !== ''

  if (!hasAmount && !hasRate) {
    return { error: '原価額または原価率のいずれかを入力してください' as const }
  }

  if (hasAmount) {
    const amount = Number(body.cost_amount)
    if (!Number.isFinite(amount) || amount < 0) {
      return { error: '原価額は0以上の数値で入力してください' as const }
    }
    return {
      cost_amount: Math.round(amount),
      cost_rate: null,
    }
  }

  const rate = Number(body.cost_rate)
  if (!Number.isFinite(rate) || rate < 0) {
    return { error: '原価率は0以上の数値で入力してください' as const }
  }

  return {
    cost_amount: null,
    cost_rate: rate,
  }
}

async function appendCostHistory(
  supabase: any,
  userId: string,
  product: Pick<ProductMasterRow, 'product_name' | 'cost_amount' | 'cost_rate'>
) {
  await (supabase as any).from('cost_history').insert({
    user_id: userId,
    product_name: product.product_name,
    cost_amount: product.cost_amount,
    cost_rate: product.cost_rate,
  })
}

async function updateProductMasterById(
  supabase: any,
  userId: string,
  productMasterId: string,
  nextCost: { cost_amount: number | null; cost_rate: number | null }
) {
  const { data: current, error: currentError } = await (supabase as any)
    .from('product_master')
    .select('*')
    .eq('id', productMasterId)
    .eq('user_id', userId)
    .single()

  if (currentError || !current) {
    throw new Error('対象の商品マスタが見つかりません')
  }

  if (current.cost_amount !== null || current.cost_rate !== null) {
    await appendCostHistory(supabase, userId, current)
  }

  const { data: updated, error: updateError } = await (supabase as any)
    .from('product_master')
    .update({
      ...nextCost,
      cost_updated_at: new Date().toISOString(),
    })
    .eq('id', productMasterId)
    .eq('user_id', userId)
    .select('*')
    .single()

  if (updateError || !updated) {
    throw new Error(updateError?.message ?? '商品マスタの更新に失敗しました')
  }

  return updated as ProductMasterRow
}

async function upsertProductMasterByName(
  supabase: any,
  userId: string,
  productName: string,
  nextCost: { cost_amount: number | null; cost_rate: number | null }
) {
  const { data: current } = await (supabase as any)
    .from('product_master')
    .select('*')
    .eq('user_id', userId)
    .eq('product_name', productName)
    .maybeSingle()

  if (current && (current.cost_amount !== null || current.cost_rate !== null)) {
    await appendCostHistory(supabase, userId, current)
  }

  const { data: updated, error: updateError } = await (supabase as any)
    .from('product_master')
    .upsert(
      {
        user_id: userId,
        product_name: productName,
        ...nextCost,
        cost_updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,product_name' }
    )
    .select('*')
    .single()

  if (updateError || !updated) {
    throw new Error(updateError?.message ?? '商品マスタの更新に失敗しました')
  }

  return updated as ProductMasterRow
}

async function persistLinks(
  supabase: any,
  orderPageId: string,
  currentNotes: string | null | undefined,
  links: {
    mobile_order_product_links: Record<string, MobileOrderProductMasterLink>
    mobile_order_option_choice_links: Record<string, MobileOrderProductMasterLink>
  }
) {
  const nextNotes = upsertProductMasterLinksInNotes(currentNotes, links)
  const { error } = await (supabase as any)
    .from('store_order_pages')
    .update({ notes: nextNotes })
    .eq('id', orderPageId)

  if (error) {
    throw new Error(error.message)
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireRouteSession(req)
  if (auth.response) return auth.response

  const { supabase, user } = auth.session

  try {
    const context = await loadProductMasterCostContext(supabase, user.id)
    const productMasterById = context.byId
    const linkedProductMasterIds = new Set<string>()
    const linkedOptionChoiceProductMasterIds = new Set<string>()

    let mobileOrderProducts: ProductMasterMobileOrderLinkPayload[] = []
    let mobileOrderOptionChoices: ProductMasterMobileOrderOptionChoiceLinkPayload[] = []
    if (context.storeId) {
      const { data: products, error: mobileOrderProductsError } = await (supabase as any)
        .from('mobile_order_products')
        .select('id, name, price')
        .eq('store_id', context.storeId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })

      if (mobileOrderProductsError) {
        throw new Error(mobileOrderProductsError.message)
      }

      mobileOrderProducts = ((products ?? []) as Array<{ id: string; name: string; price: number }>).map((product) => {
        const linked = resolveLinkedProductMaster(product.id, context.links, productMasterById)
        if (linked) {
          linkedProductMasterIds.add(linked.productMaster.id)
        }

        return {
          mobile_order_product_id: product.id,
          mobile_order_product_name: product.name,
          mobile_order_product_price: product.price,
          linked_product_master_id: linked?.productMaster.id ?? null,
          linked_product_master_name: linked?.productMaster.product_name ?? null,
          link_mode: (linked?.link.mode ?? null) as ProductMasterLinkModePayload | null,
          cost_amount: linked?.productMaster.cost_amount ?? null,
          cost_rate: linked?.productMaster.cost_rate ?? null,
          cost_updated_at: linked?.productMaster.cost_updated_at ?? null,
        }
      })

      const { data: optionChoices, error: optionChoicesError } = await (supabase as any)
        .from('mobile_order_option_choices')
        .select('id, name, price_delta, mobile_order_option_groups!inner(name, store_id)')
        .eq('mobile_order_option_groups.store_id', context.storeId)
        .order('created_at', { ascending: true })

      if (optionChoicesError) {
        throw new Error(optionChoicesError.message)
      }

      mobileOrderOptionChoices = (
        (optionChoices ?? []) as Array<{
          id: string
          name: string
          price_delta: number
          mobile_order_option_groups: { name: string; store_id: string }
        }>
      ).map((choice) => {
        const link = context.optionChoiceLinks[choice.id] ?? null
        const linked = link ? productMasterById.get(link.product_master_id) ?? null : context.byName.get(choice.name) ?? null
        if (linked) {
          linkedOptionChoiceProductMasterIds.add(linked.id)
        }

        return {
          mobile_order_option_choice_id: choice.id,
          mobile_order_option_choice_name: choice.name,
          mobile_order_option_choice_price_delta: choice.price_delta,
          mobile_order_option_group_name: choice.mobile_order_option_groups.name,
          linked_product_master_id: linked?.id ?? null,
          linked_product_master_name: linked?.product_name ?? null,
          link_mode: (link?.mode ?? null) as ProductMasterLinkModePayload | null,
          cost_amount: linked?.cost_amount ?? null,
          cost_rate: linked?.cost_rate ?? null,
          cost_updated_at: linked?.cost_updated_at ?? null,
        }
      })
    }

    const allProductMasters: ProductMasterRecordPayload[] = context.rows.map((row) => ({
      id: row.id,
      product_name: row.product_name,
      cost_amount: row.cost_amount,
      cost_rate: row.cost_rate,
      cost_updated_at: row.cost_updated_at,
    }))

    const standaloneProducts = allProductMasters.filter(
      (row) => !linkedProductMasterIds.has(row.id) && !linkedOptionChoiceProductMasterIds.has(row.id)
    )

    const payload: ProductMasterListPayload = {
      mobile_order_products: mobileOrderProducts,
      mobile_order_option_choices: mobileOrderOptionChoices,
      standalone_products: standaloneProducts,
      all_product_masters: allProductMasters,
    }

    return apiOk(payload)
  } catch (error) {
    return apiError(error instanceof Error ? error.message : 'サーバーエラー')
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRouteSession(req)
  if (auth.response) return auth.response

  const { supabase, user } = auth.session

  try {
    const body = (await req.json()) as Record<string, unknown>
    const nextCost = normalizeCostPayload(body)
    if ('error' in nextCost && nextCost.error) {
      return apiError(nextCost.error, 400)
    }

    const productMasterId = typeof body.product_master_id === 'string' ? body.product_master_id.trim() : ''
    const mobileOrderProductId =
      typeof body.mobile_order_product_id === 'string' ? body.mobile_order_product_id.trim() : ''
    const mobileOrderOptionChoiceId =
      typeof body.mobile_order_option_choice_id === 'string' ? body.mobile_order_option_choice_id.trim() : ''
    const hasLinkedProductMasterField = Object.prototype.hasOwnProperty.call(body, 'linked_product_master_id')
    const linkedProductMasterId =
      typeof body.linked_product_master_id === 'string' ? body.linked_product_master_id.trim() : ''
    const productName = typeof body.product_name === 'string' ? body.product_name.trim() : ''

    if (mobileOrderProductId) {
      const { storeId, orderPage } = await loadPrimaryStoreOrderPageForVendor(supabase, user.id)
      if (!storeId || !orderPage) {
        return apiError('モバイルオーダー設定が見つかりません', 400)
      }

      const { data: mobileOrderProduct, error: mobileOrderProductError } = await (supabase as any)
        .from('mobile_order_products')
        .select('id, name, store_id')
        .eq('id', mobileOrderProductId)
        .eq('store_id', storeId)
        .single()

      if (mobileOrderProductError || !mobileOrderProduct) {
        return apiError('対象のモバイルオーダー商品が見つかりません', 404)
      }

      const context = await loadProductMasterCostContext(supabase, user.id)
      const links = { ...context.links }
      const optionChoiceLinks = { ...context.optionChoiceLinks }
      const existingLink = links[mobileOrderProductId] ?? null

      let targetProductMaster: ProductMasterRow
      let nextMode: ProductMasterLinkMode

      if (linkedProductMasterId || productMasterId) {
        targetProductMaster = await updateProductMasterById(
          supabase,
          user.id,
          linkedProductMasterId || productMasterId,
          nextCost
        )
        nextMode = 'matched_existing'
      } else if (hasLinkedProductMasterField) {
        const exactMatch = context.byName.get(mobileOrderProduct.name) ?? null
        const existingDedicated =
          existingLink?.mode === 'dedicated'
            ? context.byId.get(existingLink.product_master_id) ?? null
            : null

        if (existingDedicated) {
          targetProductMaster = await updateProductMasterById(
            supabase,
            user.id,
            existingDedicated.id,
            nextCost
          )
        } else {
          targetProductMaster = await upsertProductMasterByName(
            supabase,
            user.id,
            mobileOrderProduct.name,
            nextCost
          )
        }
        nextMode = exactMatch && exactMatch.id === targetProductMaster.id ? 'matched_existing' : 'dedicated'
      } else if (existingLink) {
        targetProductMaster = await updateProductMasterById(
          supabase,
          user.id,
          existingLink.product_master_id,
          nextCost
        )
        nextMode = existingLink.mode
      } else {
        const exactMatch = context.byName.get(mobileOrderProduct.name) ?? null
        targetProductMaster = await upsertProductMasterByName(
          supabase,
          user.id,
          mobileOrderProduct.name,
          nextCost
        )
        nextMode = exactMatch ? 'matched_existing' : 'dedicated'
      }

      links[mobileOrderProductId] = {
        product_master_id: targetProductMaster.id,
        mode: nextMode,
      }

      await persistLinks(supabase, orderPage.id, orderPage.notes ?? null, {
        mobile_order_product_links: links,
        mobile_order_option_choice_links: optionChoiceLinks,
      })
      return apiOk<MutationSuccessPayload>({ success: true })
    }

    if (mobileOrderOptionChoiceId) {
      const { storeId, orderPage } = await loadPrimaryStoreOrderPageForVendor(supabase, user.id)
      if (!storeId || !orderPage) {
        return apiError('モバイルオーダー設定が見つかりません', 400)
      }

      const { data: optionChoice, error: optionChoiceError } = await (supabase as any)
        .from('mobile_order_option_choices')
        .select('id, name, mobile_order_option_groups!inner(store_id)')
        .eq('id', mobileOrderOptionChoiceId)
        .eq('mobile_order_option_groups.store_id', storeId)
        .single()

      if (optionChoiceError || !optionChoice) {
        return apiError('対象のトッピングが見つかりません', 404)
      }

      const context = await loadProductMasterCostContext(supabase, user.id)
      const links = { ...context.links }
      const optionChoiceLinks = { ...context.optionChoiceLinks }
      const existingLink = optionChoiceLinks[mobileOrderOptionChoiceId] ?? null

      let targetProductMaster: ProductMasterRow
      let nextMode: ProductMasterLinkMode

      if (linkedProductMasterId || productMasterId) {
        targetProductMaster = await updateProductMasterById(
          supabase,
          user.id,
          linkedProductMasterId || productMasterId,
          nextCost
        )
        nextMode = 'matched_existing'
      } else if (hasLinkedProductMasterField) {
        const exactMatch = context.byName.get(optionChoice.name) ?? null
        const existingDedicated =
          existingLink?.mode === 'dedicated'
            ? context.byId.get(existingLink.product_master_id) ?? null
            : null

        if (existingDedicated) {
          targetProductMaster = await updateProductMasterById(supabase, user.id, existingDedicated.id, nextCost)
        } else {
          targetProductMaster = await upsertProductMasterByName(supabase, user.id, optionChoice.name, nextCost)
        }
        nextMode = exactMatch && exactMatch.id === targetProductMaster.id ? 'matched_existing' : 'dedicated'
      } else if (existingLink) {
        targetProductMaster = await updateProductMasterById(
          supabase,
          user.id,
          existingLink.product_master_id,
          nextCost
        )
        nextMode = existingLink.mode
      } else {
        const exactMatch = context.byName.get(optionChoice.name) ?? null
        targetProductMaster = await upsertProductMasterByName(supabase, user.id, optionChoice.name, nextCost)
        nextMode = exactMatch ? 'matched_existing' : 'dedicated'
      }

      optionChoiceLinks[mobileOrderOptionChoiceId] = {
        product_master_id: targetProductMaster.id,
        mode: nextMode,
      }

      await persistLinks(supabase, orderPage.id, orderPage.notes ?? null, {
        mobile_order_product_links: links,
        mobile_order_option_choice_links: optionChoiceLinks,
      })
      return apiOk<MutationSuccessPayload>({ success: true })
    }

    if (productMasterId) {
      await updateProductMasterById(supabase, user.id, productMasterId, nextCost)
      return apiOk<MutationSuccessPayload>({ success: true })
    }

    if (!productName) {
      return apiError('商品名は必須です', 400)
    }

    await upsertProductMasterByName(supabase, user.id, productName, nextCost)
    return apiOk<MutationSuccessPayload>({ success: true })
  } catch (error) {
    return apiError(error instanceof Error ? error.message : 'サーバーエラー')
  }
}
