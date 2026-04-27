import type { User } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type StoreOrderScheduleInventoryRow = Database['public']['Tables']['store_order_schedule_inventories']['Row']
type MobileOrderInventoryAdjustmentRow = Database['public']['Tables']['mobile_order_inventory_adjustments']['Row']
type MobileOrderInventoryStatus = 'unmanaged' | 'not_set' | 'available' | 'low_stock' | 'sold_out'

function slugifyStoreName(value: string) {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

function buildDefaultStoreName(rawName?: string | null, email?: string | null) {
  const trimmedName = String(rawName ?? '').trim()
  if (trimmedName) return trimmedName

  const emailName = String(email ?? '').split('@')[0]?.trim()
  if (emailName) return `${emailName} store`

  return 'mobile-order-store'
}

function buildDefaultSlug(storeName: string, userId: string) {
  const normalized = slugifyStoreName(storeName)
  const suffix = userId.slice(0, 8).toLowerCase()
  return normalized ? `${normalized}-${suffix}` : `store-${suffix}`
}

export async function ensureVendorStoreResources(
  supabase: any,
  user: User,
  options?: { businessName?: string | null }
) {
  const { data: existingStore, error: storeError } = await supabase
    .from('vendor_stores')
    .select('*')
    .eq('vendor_user_id', user.id)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (storeError) {
    throw new Error(storeError.message)
  }

  let store = existingStore

  if (!store) {
    const storeName = buildDefaultStoreName(options?.businessName, user.email)
    const slug = buildDefaultSlug(storeName, user.id)

    const { data: insertedStore, error: insertStoreError } = await supabase
      .from('vendor_stores')
      .insert([
        {
          vendor_user_id: user.id,
          store_name: storeName,
          slug,
          order_number_prefix: 'A',
          is_mobile_order_enabled: false,
          is_accepting_orders: true,
        },
      ])
      .select('*')
      .single()

    if (insertStoreError) {
      throw new Error(insertStoreError.message)
    }

    store = insertedStore
  }

  const { data: existingOrderPage, error: pageError } = await supabase
    .from('store_order_pages')
    .select('*')
    .eq('store_id', store.id)
    .eq('is_primary', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (pageError) {
    throw new Error(pageError.message)
  }

  let orderPage = existingOrderPage

  if (!orderPage) {
    const { data: insertedPage, error: insertPageError } = await supabase
      .from('store_order_pages')
      .insert([
        {
          store_id: store.id,
          page_title: `${store.store_name} モバイルオーダー`,
          public_token: crypto.randomUUID().replace(/-/g, ''),
          status: 'published',
          is_primary: true,
        },
      ])
      .select('*')
      .single()

    if (insertPageError) {
      throw new Error(insertPageError.message)
    }

    orderPage = insertedPage
  } else if (orderPage.status !== 'published') {
    const { data: updatedPage, error: updatePageError } = await supabase
      .from('store_order_pages')
      .update({
        status: 'published',
      })
      .eq('id', orderPage.id)
      .select('*')
      .single()

    if (updatePageError) {
      throw new Error(updatePageError.message)
    }

    orderPage = updatedPage
  }

  return {
    store,
    orderPage,
  }
}

export function resolveActiveSchedule<T extends { opens_at: string; closes_at: string; status: string }>(schedules: T[]) {
  const now = Date.now()

  return (
    schedules.find((schedule) => {
      if (!['scheduled', 'open'].includes(schedule.status)) return false
      const startsAt = new Date(schedule.opens_at).getTime()
      const endsAt = new Date(schedule.closes_at).getTime()
      return startsAt <= now && now < endsAt
    }) ?? null
  )
}

export async function generateNextOrderNumber(
  supabase: any,
  store: { id: string; order_number_prefix: string }
) {
  const { data, error } = await supabase
    .from('mobile_orders')
    .select('order_number')
    .eq('store_id', store.id)
    .like('order_number', `${store.order_number_prefix}%`)
    .order('order_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  const latestNumber = String(data?.order_number ?? '')
  const latestSequence = Number(latestNumber.slice(1)) || 0
  const nextSequence = latestSequence + 1

  if (nextSequence > 9999) {
    throw new Error('注文番号の上限に達しました')
  }

  return `${store.order_number_prefix}${String(nextSequence).padStart(4, '0')}`
}

export async function loadOrderedQuantityByProductForSchedule(
  supabase: any,
  scheduleId: string
) {
  const { data, error } = await supabase
    .from('mobile_order_items')
    .select('product_id, quantity, mobile_orders!inner(schedule_id, status)')
    .eq('mobile_orders.schedule_id', scheduleId)
    .neq('mobile_orders.status', 'cancelled')

  if (error) {
    throw new Error(error.message)
  }

  const totals = new Map<string, number>()

  for (const row of (data ?? []) as Array<{ product_id: string; quantity: number; mobile_orders: { schedule_id: string; status: string } }>) {
    totals.set(row.product_id, (totals.get(row.product_id) ?? 0) + Number(row.quantity ?? 0))
  }

  return totals
}

export async function loadScheduleInventoryState(
  supabase: any,
  scheduleId: string,
  productIds?: string[]
) {
  let inventoryQuery = supabase
    .from('store_order_schedule_inventories')
    .select('*')
    .eq('schedule_id', scheduleId)

  let adjustmentsQuery = supabase
    .from('mobile_order_inventory_adjustments')
    .select('*')
    .eq('schedule_id', scheduleId)
    .order('created_at', { ascending: false })

  if (productIds && productIds.length > 0) {
    inventoryQuery = inventoryQuery.in('product_id', productIds)
    adjustmentsQuery = adjustmentsQuery.in('product_id', productIds)
  }

  const [{ data: inventories, error: inventoriesError }, { data: adjustments, error: adjustmentsError }] =
    await Promise.all([inventoryQuery, adjustmentsQuery])

  if (inventoriesError) {
    throw new Error(inventoriesError.message)
  }
  if (adjustmentsError) {
    throw new Error(adjustmentsError.message)
  }

  const inventoryByProduct = new Map<string, StoreOrderScheduleInventoryRow>()
  for (const inventory of (inventories ?? []) as StoreOrderScheduleInventoryRow[]) {
    inventoryByProduct.set(inventory.product_id, inventory)
  }

  const adjustmentsByProduct = new Map<string, MobileOrderInventoryAdjustmentRow[]>()
  for (const adjustment of (adjustments ?? []) as MobileOrderInventoryAdjustmentRow[]) {
    const current = adjustmentsByProduct.get(adjustment.product_id) ?? []
    current.push(adjustment)
    adjustmentsByProduct.set(adjustment.product_id, current)
  }

  return {
    inventoryByProduct,
    adjustmentsByProduct,
  }
}

export function getInventoryStatus(input: {
  tracks_inventory: boolean
  initial_quantity: number | null
  adjustment_total: number
  low_stock_threshold: number
  ordered_quantity: number
  is_sold_out: boolean
}) {
  const availableQuantity =
    input.initial_quantity == null ? null : Math.max(0, input.initial_quantity + input.adjustment_total)

  if (input.is_sold_out) {
    return {
      status: 'sold_out' as MobileOrderInventoryStatus,
      availableQuantity,
      remainingQuantity: availableQuantity == null ? null : Math.max(0, availableQuantity - input.ordered_quantity),
    }
  }

  if (!input.tracks_inventory) {
    return {
      status: 'unmanaged' as MobileOrderInventoryStatus,
      availableQuantity: null,
      remainingQuantity: null,
    }
  }

  if (input.initial_quantity == null) {
    return {
      status: 'not_set' as MobileOrderInventoryStatus,
      availableQuantity: null,
      remainingQuantity: null,
    }
  }

  const remainingQuantity = Math.max(0, (availableQuantity ?? 0) - input.ordered_quantity)

  if (remainingQuantity <= 0) {
    return {
      status: 'sold_out' as MobileOrderInventoryStatus,
      availableQuantity: availableQuantity ?? 0,
      remainingQuantity: 0,
    }
  }

  if (remainingQuantity <= input.low_stock_threshold) {
    return {
      status: 'low_stock' as MobileOrderInventoryStatus,
      availableQuantity: availableQuantity ?? remainingQuantity,
      remainingQuantity,
    }
  }

  return {
    status: 'available' as MobileOrderInventoryStatus,
    availableQuantity: availableQuantity ?? remainingQuantity,
    remainingQuantity,
  }
}
