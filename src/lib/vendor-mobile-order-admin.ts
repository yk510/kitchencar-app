import {
  ensureVendorStoreResources,
  getInventoryStatus,
  loadOrderedQuantityByProductForSchedule,
  loadScheduleInventoryState,
  resolveActiveSchedule,
} from '@/lib/mobile-order'
import { applyReceiptPrintSettingsToStore } from '@/lib/receipt-print-settings'
import { applyMetadataToSchedule } from '@/lib/store-order-schedule-metadata'
import { applyStorePosSettingsToStore } from '@/lib/store-pos-settings'
import type {
  MobileOrderInventoryAdjustmentRow,
  StoreOrderScheduleRow,
  VendorMobileOrderProductsPayload,
  VendorMobileOrderSchedulesPayload,
} from '@/types/api-payloads'

export async function loadVendorMobileOrderAdminStoreContext(
  supabase: any,
  user: { id: string },
  businessName?: string | null
) {
  return ensureVendorStoreResources(supabase, user, {
    businessName: businessName ?? null,
  })
}

export async function loadVendorMobileOrderSchedulesPayload(
  supabase: any,
  user: { id: string },
  businessName?: string | null
): Promise<VendorMobileOrderSchedulesPayload> {
  const { store, orderPage } = await loadVendorMobileOrderAdminStoreContext(supabase, user, businessName)

  const { data: schedules, error } = await (supabase as any)
    .from('store_order_schedules')
    .select('*')
    .eq('store_id', store.id)
    .order('business_date', { ascending: true })
    .order('opens_at', { ascending: true })

  const { data: locations, error: locationsError } = await (supabase as any)
    .from('locations')
    .select('id, name, address')
    .eq('user_id', user.id)
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)
  if (locationsError) throw new Error(locationsError.message)

  return {
    store: applyReceiptPrintSettingsToStore(applyStorePosSettingsToStore(store, orderPage), orderPage),
    orderPage,
    schedules: ((schedules ?? []) as any[]).map((schedule) => applyMetadataToSchedule(schedule)),
    locations: (locations ?? []) as any[],
  }
}

export async function loadVendorMobileOrderProductsPayload(
  supabase: any,
  user: { id: string },
  businessName?: string | null
): Promise<VendorMobileOrderProductsPayload> {
  const { store } = await loadVendorMobileOrderAdminStoreContext(supabase, user, businessName)

  const [{ data: products, error }, { data: schedules, error: schedulesError }] = await Promise.all([
    (supabase as any)
      .from('mobile_order_products')
      .select('*')
      .eq('store_id', store.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    (supabase as any)
      .from('store_order_schedules')
      .select('*')
      .eq('store_id', store.id)
      .order('opens_at', { ascending: true }),
  ])

  if (error) throw new Error(error.message)
  if (schedulesError) throw new Error(schedulesError.message)

  const currentSchedule = resolveActiveSchedule((schedules ?? []) as StoreOrderScheduleRow[])
  const orderedQuantityByProduct = currentSchedule
    ? await loadOrderedQuantityByProductForSchedule(supabase, currentSchedule.id)
    : new Map<string, number>()
  const { inventoryByProduct, adjustmentsByProduct } = currentSchedule
    ? await loadScheduleInventoryState(
        supabase,
        currentSchedule.id,
        ((products ?? []) as Array<{ id: string }>).map((product) => product.id)
      )
    : { inventoryByProduct: new Map(), adjustmentsByProduct: new Map() }

  const managedProducts = ((products ?? []) as any[]).map((product) => {
    const currentOrderedQuantity = orderedQuantityByProduct.get(product.id) ?? 0
    const currentInventory = inventoryByProduct.get(product.id) ?? null
    const currentAdjustments = (adjustmentsByProduct.get(product.id) ?? []) as MobileOrderInventoryAdjustmentRow[]
    const adjustmentTotal = currentAdjustments.reduce(
      (sum: number, adjustment: MobileOrderInventoryAdjustmentRow) => sum + Number(adjustment.adjustment_quantity ?? 0),
      0
    )
    const inventory = getInventoryStatus({
      tracks_inventory: product.tracks_inventory,
      initial_quantity: currentInventory?.initial_quantity ?? null,
      adjustment_total: adjustmentTotal,
      low_stock_threshold: product.low_stock_threshold,
      ordered_quantity: currentOrderedQuantity,
      is_sold_out: product.is_sold_out,
    })

    return {
      ...product,
      display_category:
        product.display_category === 'main' ||
        product.display_category === 'side' ||
        product.display_category === 'drink' ||
        product.display_category === 'other'
          ? product.display_category
          : 'other',
      is_recommended: typeof product.is_recommended === 'boolean' ? product.is_recommended : false,
      current_schedule_inventory_id: currentInventory?.id ?? null,
      current_initial_quantity: currentInventory?.initial_quantity ?? null,
      current_adjustment_total: adjustmentTotal,
      current_available_quantity: inventory.availableQuantity,
      current_ordered_quantity: currentOrderedQuantity,
      current_remaining_quantity: inventory.remainingQuantity,
      current_inventory_status: inventory.status,
      current_inventory_adjustments: currentAdjustments,
    }
  })

  return {
    store,
    currentSchedule,
    products: managedProducts,
  }
}
