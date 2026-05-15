import type { AnalyticsScopeFilter, StallLogResolution } from '@/lib/analytics-resolution'
import { matchesAnalyticsScope, resolveAnalyticsEventId } from '@/lib/analytics-resolution'

export type MobileOrderAnalyticsSource = 'mobile_order' | 'store_pos'

export type MobileOrderAnalyticsOrder = {
  id: string
  scheduleId: string
  businessDate: string
  orderedAt: string
  hourOfDay: number
  dayOfWeek: number
  totalAmount: number
  paymentStatus: string
  status: string
  paymentProvider: string | null
  source: MobileOrderAnalyticsSource
  eventId: string | null
}

export type MobileOrderAnalyticsItem = {
  orderId: string
  productName: string
  quantity: number
  lineTotalAmount: number
}

type MobileOrderScheduleRow = {
  id: string
  business_date: string
}

type RawMobileOrderRow = {
  id: string
  schedule_id: string
  ordered_at: string
  total_amount: number | null
  payment_status: string
  status: string
  payment_provider: string | null
}

type RawMobileOrderItemRow = {
  order_id: string
  product_name_snapshot: string
  quantity: number | null
  line_total_amount: number | null
}

const JST_HOUR_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Tokyo',
  hour: '2-digit',
  hour12: false,
})

function resolveMobileOrderSource(paymentProvider: string | null | undefined): MobileOrderAnalyticsSource {
  return String(paymentProvider ?? '').startsWith('store_pos_') ? 'store_pos' : 'mobile_order'
}

function isCountableMobileOrder(order: RawMobileOrderRow) {
  if (order.status === 'cancelled') return false

  const source = resolveMobileOrderSource(order.payment_provider)
  if (source === 'store_pos') {
    return order.payment_status === 'paid'
  }

  return ['paid', 'authorized'].includes(order.payment_status)
}

function getJstHour(orderedAt: string) {
  return Number(JST_HOUR_FORMATTER.format(new Date(orderedAt)))
}

function getDayOfWeekFromBusinessDate(businessDate: string) {
  return new Date(`${businessDate}T00:00:00+09:00`).getDay()
}

export async function fetchMobileOrderAnalyticsData(
  supabase: any,
  params: {
    scope: AnalyticsScopeFilter
    start?: string
    end?: string
    stallLogByDate: Map<string, StallLogResolution>
  }
): Promise<{
  orders: MobileOrderAnalyticsOrder[]
  items: MobileOrderAnalyticsItem[]
}> {
  const { scope, start, end, stallLogByDate } = params

  let schedulesQuery = (supabase as any)
    .from('store_order_schedules')
    .select('id, business_date')

  if (start) schedulesQuery = schedulesQuery.gte('business_date', start)
  if (end) schedulesQuery = schedulesQuery.lte('business_date', end)

  const { data: schedules, error: schedulesError } = await schedulesQuery
  if (schedulesError) {
    throw new Error(schedulesError.message)
  }

  const scheduleRows = (schedules ?? []) as MobileOrderScheduleRow[]
  if (scheduleRows.length === 0) {
    return { orders: [], items: [] }
  }

  const scheduleDateMap = new Map(scheduleRows.map((row) => [row.id, row.business_date]))
  const scheduleIds = scheduleRows.map((row) => row.id)

  const { data: rawOrders, error: ordersError } = await (supabase as any)
    .from('mobile_orders')
    .select('id, schedule_id, ordered_at, total_amount, payment_status, status, payment_provider')
    .in('schedule_id', scheduleIds)

  if (ordersError) {
    throw new Error(ordersError.message)
  }

  const normalizedOrders = ((rawOrders ?? []) as RawMobileOrderRow[])
    .filter(isCountableMobileOrder)
    .map((order) => {
      const businessDate = scheduleDateMap.get(order.schedule_id)
      if (!businessDate) return null

      const resolvedEventId = resolveAnalyticsEventId(businessDate, null, stallLogByDate)
      if (!matchesAnalyticsScope(scope, resolvedEventId)) return null

      return {
        id: order.id,
        scheduleId: order.schedule_id,
        businessDate,
        orderedAt: order.ordered_at,
        hourOfDay: getJstHour(order.ordered_at),
        dayOfWeek: getDayOfWeekFromBusinessDate(businessDate),
        totalAmount: order.total_amount ?? 0,
        paymentStatus: order.payment_status,
        status: order.status,
        paymentProvider: order.payment_provider ?? null,
        source: resolveMobileOrderSource(order.payment_provider),
        eventId: resolvedEventId,
      } satisfies MobileOrderAnalyticsOrder
    })
    .filter((order): order is MobileOrderAnalyticsOrder => order != null)

  if (normalizedOrders.length === 0) {
    return { orders: [], items: [] }
  }

  const orderIds = normalizedOrders.map((order) => order.id)

  const { data: rawItems, error: itemsError } = await (supabase as any)
    .from('mobile_order_items')
    .select('order_id, product_name_snapshot, quantity, line_total_amount')
    .in('order_id', orderIds)

  if (itemsError) {
    throw new Error(itemsError.message)
  }

  const items = ((rawItems ?? []) as RawMobileOrderItemRow[]).map((item) => ({
    orderId: item.order_id,
    productName: item.product_name_snapshot,
    quantity: item.quantity ?? 0,
    lineTotalAmount: item.line_total_amount ?? 0,
  }))

  return {
    orders: normalizedOrders,
    items,
  }
}
