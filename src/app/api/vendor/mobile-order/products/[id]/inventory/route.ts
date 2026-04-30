import { NextRequest } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import type { StoreOrderScheduleInventoryRow } from '@/types/api-payloads'

export async function POST(
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
    const scheduleId = String(body.schedule_id ?? '').trim()
    const initialQuantity = Number(body.initial_quantity)

    if (!scheduleId) {
      return apiError('営業枠が指定されていません', 400)
    }
    if (!Number.isInteger(initialQuantity) || initialQuantity < 0) {
      return apiError('初期在庫数は0以上の整数で入力してください', 400)
    }

    const { data: product, error: productError } = await (supabase as any)
      .from('mobile_order_products')
      .select('*, vendor_stores!inner(vendor_user_id)')
      .eq('id', id)
      .eq('vendor_stores.vendor_user_id', user.id)
      .single()

    if (productError || !product) {
      return apiError('対象の商品が見つかりません', 404)
    }
    if (!product.tracks_inventory) {
      return apiError('この商品は在庫管理が無効です', 409)
    }

    const { data: schedule, error: scheduleError } = await (supabase as any)
      .from('store_order_schedules')
      .select('id, store_id')
      .eq('id', scheduleId)
      .eq('store_id', product.store_id)
      .maybeSingle()

    if (scheduleError) {
      return apiError(scheduleError.message)
    }
    if (!schedule) {
      return apiError('対象の営業枠が見つかりません', 404)
    }

    const { data: existingInventory, error: existingError } = await (supabase as any)
      .from('store_order_schedule_inventories')
      .select('id')
      .eq('schedule_id', scheduleId)
      .eq('product_id', id)
      .maybeSingle()

    if (existingError) {
      return apiError(existingError.message)
    }
    if (existingInventory) {
      return apiError('初期在庫はすでに設定済みです。変更は在庫調整で行ってください', 409)
    }

    const { data, error } = await (supabase as any)
      .from('store_order_schedule_inventories')
      .insert([
        {
          schedule_id: scheduleId,
          product_id: id,
          initial_quantity: initialQuantity,
        },
      ])
      .select('*')
      .single()

    if (error) {
      return apiError(error.message)
    }

    const payload: StoreOrderScheduleInventoryRow = data
    return apiOk(payload)
  } catch (error) {
    console.error('[vendor/mobile-order/products/:id/inventory POST]', error)
    return apiError('サーバーエラー')
  }
}
