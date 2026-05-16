import { ensureVendorStoreResources, resolveActiveSchedule } from '@/lib/mobile-order'
import { isStorePosOrder } from '@/lib/mobile-order-fields'
import type {
  MobileOrderRow,
  StoreOrderScheduleRow,
  VendorMobileOrderDashboardOrder,
  VendorMobileOrderListItem,
  VendorStoreRow,
} from '@/types/api-payloads'

type SupabaseClientLike = any
type UserLike = { id: string }

export function pickSelectedSchedule(
  schedules: StoreOrderScheduleRow[],
  requestedScheduleId: string | null
) {
  if (requestedScheduleId) {
    return schedules.find((schedule) => schedule.id === requestedScheduleId) ?? null
  }

  const activeSchedule = resolveActiveSchedule(
    [...schedules].sort(
      (a, b) => new Date(a.opens_at).getTime() - new Date(b.opens_at).getTime()
    )
  )
  if (activeSchedule) return activeSchedule

  return schedules[0] ?? null
}

export async function resolveVendorOrderDashboardContext(
  supabase: SupabaseClientLike,
  user: UserLike,
  requestedScheduleId: string | null
): Promise<{
  store: VendorStoreRow
  schedules: StoreOrderScheduleRow[]
  selectedSchedule: StoreOrderScheduleRow | null
}> {
  const { data: vendorProfile } = await supabase
    .from('vendor_profiles')
    .select('business_name')
    .eq('user_id', user.id)
    .maybeSingle()

  const { store } = await ensureVendorStoreResources(supabase, user, {
    businessName: vendorProfile?.business_name ?? null,
  })

  const { data: schedules, error: schedulesError } = await supabase
    .from('store_order_schedules')
    .select('*')
    .eq('store_id', store.id)
    .order('opens_at', { ascending: false })

  if (schedulesError) {
    throw new Error(schedulesError.message)
  }

  const normalizedSchedules = (schedules ?? []) as StoreOrderScheduleRow[]
  const selectedSchedule = pickSelectedSchedule(normalizedSchedules, requestedScheduleId)

  return {
    store,
    schedules: normalizedSchedules,
    selectedSchedule,
  }
}

function shouldIncludeDashboardOrder(order: Pick<MobileOrderRow, 'payment_status' | 'payment_provider' | 'order_source'>) {
  if (isStorePosOrder(order)) {
    return ['pending', 'paid', 'authorized'].includes(order.payment_status)
  }

  return ['paid', 'authorized'].includes(order.payment_status)
}

export async function fetchVendorOrderList(
  supabase: SupabaseClientLike,
  storeId: string,
  scheduleId: string | null
): Promise<VendorMobileOrderListItem[]> {
  if (!scheduleId) return []

  const { data, error } = await supabase
    .from('mobile_orders')
    .select(
      'id,store_id,schedule_id,order_number,pickup_nickname,status,payment_status,payment_provider,payment_method,total_amount,ordered_at,ready_notified_at,picked_up_at,cancelled_at,customer_line_user_id,customer_line_display_name,created_at,updated_at,order_source,paid_at,accepted_by_user_id,pos_device_label,mobile_order_items(id)'
    )
    .eq('store_id', storeId)
    .eq('schedule_id', scheduleId)
    .order('ordered_at', { ascending: false })

  if (error) {
    throw new Error(error.message)
  }

  return ((data ?? []) as Array<MobileOrderRow & { mobile_order_items?: Array<{ id: string }> }>)
    .filter((order) => shouldIncludeDashboardOrder(order))
    .map(({ mobile_order_items, ...order }) => ({
      ...order,
      item_count: mobile_order_items?.length ?? 0,
    }))
}

export async function fetchVendorOrderCounts(
  supabase: SupabaseClientLike,
  storeId: string,
  scheduleId: string | null
) {
  if (!scheduleId) {
    return {
      placed: 0,
      preparing: 0,
      ready: 0,
      picked_up: 0,
      total: 0,
    }
  }

  const { data, error } = await supabase
    .from('mobile_orders')
    .select('status,payment_status,payment_provider,order_source')
    .eq('store_id', storeId)
    .eq('schedule_id', scheduleId)

  if (error) {
    throw new Error(error.message)
  }

  const visibleOrders = ((data ?? []) as Array<
    Pick<MobileOrderRow, 'status' | 'payment_status' | 'payment_provider' | 'order_source'>
  >).filter((order) => shouldIncludeDashboardOrder(order))

  return {
    placed: visibleOrders.filter((order) => order.status === 'placed').length,
    preparing: visibleOrders.filter((order) => order.status === 'preparing').length,
    ready: visibleOrders.filter((order) => order.status === 'ready').length,
    picked_up: visibleOrders.filter((order) => order.status === 'picked_up').length,
    total: visibleOrders.length,
  }
}

export async function fetchVendorOrderDetail(
  supabase: SupabaseClientLike,
  storeId: string,
  orderId: string
): Promise<VendorMobileOrderDashboardOrder | null> {
  const { data, error } = await supabase
    .from('mobile_orders')
    .select(
      '*, mobile_order_items(*, mobile_order_item_option_choices(*)), mobile_order_notifications(*)'
    )
    .eq('store_id', storeId)
    .eq('id', orderId)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return (data as VendorMobileOrderDashboardOrder | null) ?? null
}
