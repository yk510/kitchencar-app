import type { MobileOrderInventoryAdjustmentRow, StoreOrderScheduleInventoryRow } from '@/types/api-payloads'
import { loadVendorOwnedMobileOrderProduct } from '@/lib/vendor-mobile-order-products-admin'

export function parseInitialInventoryInput(body: any) {
  const scheduleId = String(body.schedule_id ?? '').trim()
  const initialQuantity = Number(body.initial_quantity)

  if (!scheduleId) {
    throw new Error('営業枠が指定されていません')
  }
  if (!Number.isInteger(initialQuantity) || initialQuantity < 0) {
    throw new Error('初期在庫数は0以上の整数で入力してください')
  }

  return { scheduleId, initialQuantity }
}

export function parseInventoryAdjustmentInput(body: any) {
  const scheduleId = String(body.schedule_id ?? '').trim()
  const adjustmentQuantity = Number(body.adjustment_quantity)
  const reason = String(body.reason ?? '').trim() || null

  if (!scheduleId) {
    throw new Error('営業枠が指定されていません')
  }
  if (!Number.isInteger(adjustmentQuantity) || adjustmentQuantity === 0) {
    throw new Error('在庫調整数は0以外の整数で入力してください')
  }

  return { scheduleId, adjustmentQuantity, reason }
}

export async function createInitialInventoryForVendorProduct(
  supabase: any,
  user: { id: string },
  productId: string,
  input: ReturnType<typeof parseInitialInventoryInput>
): Promise<StoreOrderScheduleInventoryRow> {
  const product = await loadVendorOwnedMobileOrderProduct(supabase, user.id, productId)
  if (!product.tracks_inventory) {
    throw new Error('この商品は在庫管理が無効です')
  }

  const { data: schedule, error: scheduleError } = await (supabase as any)
    .from('store_order_schedules')
    .select('id, store_id')
    .eq('id', input.scheduleId)
    .eq('store_id', product.store_id)
    .maybeSingle()

  if (scheduleError) {
    throw new Error(scheduleError.message)
  }
  if (!schedule) {
    throw new Error('対象の営業枠が見つかりません')
  }

  const { data: existingInventory, error: existingError } = await (supabase as any)
    .from('store_order_schedule_inventories')
    .select('id')
    .eq('schedule_id', input.scheduleId)
    .eq('product_id', productId)
    .maybeSingle()

  if (existingError) {
    throw new Error(existingError.message)
  }
  if (existingInventory) {
    throw new Error('初期在庫はすでに設定済みです。変更は在庫調整で行ってください')
  }

  const { data, error } = await (supabase as any)
    .from('store_order_schedule_inventories')
    .insert([
      {
        schedule_id: input.scheduleId,
        product_id: productId,
        initial_quantity: input.initialQuantity,
      },
    ])
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

export async function createInventoryAdjustmentForVendorProduct(
  supabase: any,
  user: { id: string },
  productId: string,
  input: ReturnType<typeof parseInventoryAdjustmentInput>
): Promise<MobileOrderInventoryAdjustmentRow> {
  const product = await loadVendorOwnedMobileOrderProduct(supabase, user.id, productId)
  if (!product.tracks_inventory) {
    throw new Error('この商品は在庫管理が無効です')
  }

  const { data: scheduleInventory, error: inventoryError } = await (supabase as any)
    .from('store_order_schedule_inventories')
    .select('id, schedule_id, product_id')
    .eq('schedule_id', input.scheduleId)
    .eq('product_id', productId)
    .maybeSingle()

  if (inventoryError) {
    throw new Error(inventoryError.message)
  }
  if (!scheduleInventory) {
    throw new Error('先に初期在庫を設定してください')
  }

  const { data, error } = await (supabase as any)
    .from('mobile_order_inventory_adjustments')
    .insert([
      {
        schedule_inventory_id: scheduleInventory.id,
        schedule_id: input.scheduleId,
        product_id: productId,
        adjustment_quantity: input.adjustmentQuantity,
        reason: input.reason,
        created_by: user.id,
      },
    ])
    .select('*')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  return data
}
