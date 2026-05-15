import { NextRequest } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import { isMissingMobileOrderProductDisplayColumnsError } from '@/lib/mobile-order-fields'
import type { VendorMobileOrderProductMutationPayload } from '@/types/api-payloads'

function normalizeMaybeBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : undefined
}

function normalizeProductDisplayCategory(value: unknown) {
  return value === 'main' || value === 'side' || value === 'drink' || value === 'other' ? value : 'other'
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireRouteSession(req)
  if (auth.response) return auth.response

  if (auth.session.role !== 'vendor') {
    return apiError('ベンダー権限が必要です', 403)
  }

  const { id } = await context.params
  const { supabase, user } = auth.session

  try {
    const body = await req.json()

    const { data: current, error: fetchError } = await (supabase as any)
      .from('mobile_order_products')
      .select('*, vendor_stores!inner(vendor_user_id)')
      .eq('id', id)
      .eq('vendor_stores.vendor_user_id', user.id)
      .single()

    if (fetchError || !current) {
      return apiError('対象の商品が見つかりません', 404)
    }

    const nextName = typeof body.name === 'string' ? body.name.trim() : current.name
    const nextDescription =
      typeof body.description === 'string'
        ? body.description.trim() || null
        : body.description === null
          ? null
          : current.description
    const nextImageUrl =
      typeof body.image_url === 'string'
        ? body.image_url.trim() || null
        : body.image_url === null
          ? null
          : current.image_url
    const nextPrice = body.price != null ? Number(body.price) : current.price
    const nextSortOrder = body.sort_order != null ? Number(body.sort_order) : current.sort_order
    const nextDisplayCategory =
      body.display_category != null
        ? normalizeProductDisplayCategory(body.display_category)
        : normalizeProductDisplayCategory(current.display_category)
    const nextRecommended = normalizeMaybeBoolean(body.is_recommended) ?? (typeof current.is_recommended === 'boolean' ? current.is_recommended : false)
    const nextTracksInventory =
      typeof body.tracks_inventory === 'boolean' ? body.tracks_inventory : current.tracks_inventory
    const nextLowStockThreshold =
      body.low_stock_threshold === ''
        ? 3
        : body.low_stock_threshold != null
          ? Number(body.low_stock_threshold)
          : current.low_stock_threshold
    const nextPublished = normalizeMaybeBoolean(body.is_published) ?? current.is_published
    const nextSoldOut = normalizeMaybeBoolean(body.is_sold_out) ?? current.is_sold_out

    if (!nextName) {
      return apiError('商品名は必須です', 400)
    }

    if (!Number.isInteger(nextPrice) || nextPrice < 0) {
      return apiError('価格は0円以上の整数で入力してください', 400)
    }

    if (!Number.isInteger(nextSortOrder) || nextSortOrder < 0) {
      return apiError('表示順は0以上の整数で入力してください', 400)
    }
    if (!Number.isInteger(nextLowStockThreshold) || nextLowStockThreshold < 0) {
      return apiError('残りわずか閾値は0以上の整数で入力してください', 400)
    }

    const basePatch = {
      name: nextName,
      description: nextDescription,
      price: nextPrice,
      image_url: nextImageUrl,
      sort_order: nextSortOrder,
      tracks_inventory: nextTracksInventory,
      low_stock_threshold: nextLowStockThreshold,
      is_published: nextPublished,
      is_sold_out: nextSoldOut,
    }

    let data
    let error

    ;({ data, error } = await (supabase as any)
      .from('mobile_order_products')
      .update({
        ...basePatch,
        display_category: nextDisplayCategory,
        is_recommended: nextRecommended,
      })
      .eq('id', id)
      .select('*')
      .single())

    if (error && isMissingMobileOrderProductDisplayColumnsError(error)) {
      ;({ data, error } = await (supabase as any)
        .from('mobile_order_products')
        .update(basePatch)
        .eq('id', id)
        .select('*')
        .single())
    }

    if (error) {
      return apiError(error.message)
    }

    const payload: VendorMobileOrderProductMutationPayload = {
      ...data,
      display_category: normalizeProductDisplayCategory(data.display_category),
      is_recommended: typeof data.is_recommended === 'boolean' ? data.is_recommended : false,
    }
    return apiOk(payload)
  } catch (error) {
    console.error('[vendor/mobile-order/products/:id PATCH]', error)
    return apiError('サーバーエラー')
  }
}
