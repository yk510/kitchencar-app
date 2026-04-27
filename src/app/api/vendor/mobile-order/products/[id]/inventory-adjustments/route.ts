import { NextRequest } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import type { MobileOrderInventoryAdjustmentRow } from '@/types/api-payloads'

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
    const adjustmentQuantity = Number(body.adjustment_quantity)
    const reason = String(body.reason ?? '').trim() || null

    if (!scheduleId) {
      return apiError('営業枠が指定されていません', 400)
    }
    if (!Number.isInteger(adjustmentQuantity) || adjustmentQuantity === 0) {
      return apiError('在庫調整数は0以外の整数で入力してください', 400)
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

    const { data: scheduleInventory, error: inventoryError } = await (supabase as any)
      .from('store_order_schedule_inventories')
      .select('id, schedule_id, product_id')
      .eq('schedule_id', scheduleId)
      .eq('product_id', id)
      .maybeSingle()

    if (inventoryError) {
      return apiError(inventoryError.message)
    }
    if (!scheduleInventory) {
      return apiError('先に初期在庫を設定してください', 409)
    }

    const { data, error } = await (supabase as any)
      .from('mobile_order_inventory_adjustments')
      .insert([
        {
          schedule_inventory_id: scheduleInventory.id,
          schedule_id: scheduleId,
          product_id: id,
          adjustment_quantity: adjustmentQuantity,
          reason,
          created_by: user.id,
        },
      ])
      .select('*')
      .single()

    if (error) {
      return apiError(error.message)
    }

    const payload: MobileOrderInventoryAdjustmentRow = data
    return apiOk(payload)
  } catch (error) {
    console.error('[vendor/mobile-order/products/:id/inventory-adjustments POST]', error)
    return apiError('サーバーエラー')
  }
}
