import {
  loadOrderedQuantityByProductForSchedule,
  loadScheduleInventoryState,
} from '@/lib/mobile-order'
import type {
  MobileOrderInventoryAdjustmentRow,
  MobileOrderProductRow,
} from '@/types/api-payloads'

export type PublicOrderInventoryState = {
  orderedQuantityByProduct: Map<string, number>
  inventoryByProduct: Map<string, { id: string; product_id: string; initial_quantity: number }>
  adjustmentsByProduct: Map<string, MobileOrderInventoryAdjustmentRow[]>
}

export async function loadPublicOrderInventoryState(
  supabase: any,
  scheduleId: string | null,
  products: MobileOrderProductRow[]
): Promise<PublicOrderInventoryState> {
  if (!scheduleId) {
    return {
      orderedQuantityByProduct: new Map(),
      inventoryByProduct: new Map(),
      adjustmentsByProduct: new Map(),
    }
  }

  const orderedQuantityByProduct = await loadOrderedQuantityByProductForSchedule(supabase, scheduleId)
  const { inventoryByProduct, adjustmentsByProduct } = await loadScheduleInventoryState(
    supabase,
    scheduleId,
    products.map((product) => product.id)
  )

  return {
    orderedQuantityByProduct,
    inventoryByProduct,
    adjustmentsByProduct,
  }
}
