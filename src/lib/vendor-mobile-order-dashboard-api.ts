import { ensureVendorStoreResources } from '@/lib/mobile-order'
import { resolveReceiptPrintSettings } from '@/lib/receipt-print-settings'
import {
  fetchVendorOrderCounts,
  fetchVendorOrderDetail,
  fetchVendorOrderList,
  resolveVendorOrderDashboardContext,
} from '@/lib/vendor-mobile-order-dashboard'
import type {
  MobileOrderNotificationRow,
  MobileOrderRow,
  StoreOrderPageRow,
  VendorMobileOrderOrderDetailPayload,
  VendorMobileOrderDashboardOrder,
  VendorMobileOrderOrdersListPayload,
  VendorMobileOrderOrdersPayload,
  VendorMobileOrderOrdersSummaryPayload,
  VendorStoreRow,
} from '@/types/api-payloads'

type SupabaseClientLike = any
type UserLike = { id: string }

async function loadVendorBusinessName(supabase: SupabaseClientLike, userId: string) {
  const { data: vendorProfile } = await (supabase as any)
    .from('vendor_profiles')
    .select('business_name')
    .eq('user_id', userId)
    .maybeSingle()

  return vendorProfile?.business_name ?? null
}

export async function ensureVendorDashboardStore(
  supabase: SupabaseClientLike,
  user: UserLike
): Promise<VendorStoreRow> {
  const businessName = await loadVendorBusinessName(supabase, user.id)
  const { store } = await ensureVendorStoreResources(supabase, user, {
    businessName,
  })
  return store
}

export async function getVendorOrderDashboardPayload(
  supabase: SupabaseClientLike,
  user: UserLike,
  requestedScheduleId: string | null
): Promise<VendorMobileOrderOrdersPayload> {
  const { store, schedules, selectedSchedule } = await resolveVendorOrderDashboardContext(
    supabase,
    user,
    requestedScheduleId
  )

  const [counts, orders] = await Promise.all([
    fetchVendorOrderCounts(supabase, store.id, selectedSchedule?.id ?? null),
    fetchVendorOrderList(supabase, store.id, selectedSchedule?.id ?? null),
  ])

  return {
    store,
    schedules,
    selectedSchedule,
    counts,
    orders,
  }
}

export async function getVendorOrderDashboardListPayload(
  supabase: SupabaseClientLike,
  user: UserLike,
  requestedScheduleId: string | null
): Promise<VendorMobileOrderOrdersListPayload> {
  const { store, selectedSchedule } = await resolveVendorOrderDashboardContext(
    supabase,
    user,
    requestedScheduleId
  )

  return {
    orders: await fetchVendorOrderList(supabase, store.id, selectedSchedule?.id ?? null),
  }
}

export async function getVendorOrderDashboardSummaryPayload(
  supabase: SupabaseClientLike,
  user: UserLike,
  requestedScheduleId: string | null
): Promise<VendorMobileOrderOrdersSummaryPayload> {
  const { store, selectedSchedule } = await resolveVendorOrderDashboardContext(
    supabase,
    user,
    requestedScheduleId
  )

  return fetchVendorOrderCounts(supabase, store.id, selectedSchedule?.id ?? null)
}

export async function getVendorOrderDetailPayload(
  supabase: SupabaseClientLike,
  user: UserLike,
  orderId: string
): Promise<VendorMobileOrderOrderDetailPayload> {
  const store = await ensureVendorDashboardStore(supabase, user)
  const order = await fetchVendorOrderDetail(supabase, store.id, orderId)
  return { order }
}

export async function loadVendorOwnedOrder(
  supabase: SupabaseClientLike,
  user: UserLike,
  orderId: string
): Promise<MobileOrderRow> {
  const store = await ensureVendorDashboardStore(supabase, user)
  const { data: order, error } = await (supabase as any)
    .from('mobile_orders')
    .select('*')
    .eq('id', orderId)
    .eq('store_id', store.id)
    .single()

  if (error || !order) {
    throw new Error('対象の注文が見つかりません')
  }

  return order as MobileOrderRow
}

export async function getVendorOrderReceiptPrintContext(
  supabase: SupabaseClientLike,
  user: UserLike,
  orderId: string
): Promise<{
  store: VendorStoreRow
  orderPage: StoreOrderPageRow
  order: VendorMobileOrderDashboardOrder
  receiptSettings: ReturnType<typeof resolveReceiptPrintSettings>
}> {
  const businessName = await loadVendorBusinessName(supabase, user.id)
  const { store, orderPage } = await ensureVendorStoreResources(supabase, user, {
    businessName,
  })

  const order = await fetchVendorOrderDetail(supabase, store.id, orderId)
  if (!order) {
    throw new Error('対象の注文が見つかりません')
  }

  return {
    store,
    orderPage,
    order,
    receiptSettings: resolveReceiptPrintSettings(store, orderPage),
  }
}

export async function loadVendorOwnedNotification(
  supabase: SupabaseClientLike,
  user: UserLike,
  orderId: string,
  notificationId: string
): Promise<MobileOrderNotificationRow> {
  await loadVendorOwnedOrder(supabase, user, orderId)

  const { data: notification, error } = await (supabase as any)
    .from('mobile_order_notifications')
    .select('*')
    .eq('id', notificationId)
    .eq('order_id', orderId)
    .single()

  if (error || !notification) {
    throw new Error('対象の通知が見つかりません')
  }

  return notification as MobileOrderNotificationRow
}
