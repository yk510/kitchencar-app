import type { AnalyticsScopeFilter, StallLogResolution } from '@/lib/analytics-resolution'
import { matchesAnalyticsScope, resolveAnalyticsEventId } from '@/lib/analytics-resolution'
import { extractStoreOrderScheduleMetadata } from '@/lib/store-order-schedule-metadata'

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
  eventName: string | null
  locationId: string | null
}

export type MobileOrderAnalyticsItem = {
  orderId: string
  productId: string
  productName: string
  quantity: number
  lineTotalAmount: number
  optionChoices: Array<{
    optionChoiceName: string
    priceDelta: number
  }>
}

function toJstDate(value: string) {
  const date = new Date(value)
  const year = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
  }).format(date)
  const month = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    month: '2-digit',
  }).format(date)
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    day: '2-digit',
  }).format(date)

  return `${year}-${month}-${day}`
}

function toJstRangeStart(value: string) {
  return new Date(`${value}T00:00:00+09:00`).toISOString()
}

function toJstRangeEnd(value: string) {
  return new Date(`${value}T23:59:59.999+09:00`).toISOString()
}

type MobileOrderScheduleRow = {
  id: string
  business_date: string
  notes: string | null
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
  product_id: string
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

  let ordersQuery = (supabase as any)
    .from('mobile_orders')
    .select('id, schedule_id, ordered_at, total_amount, payment_status, status, payment_provider')

  if (start) ordersQuery = ordersQuery.gte('ordered_at', toJstRangeStart(start))
  if (end) ordersQuery = ordersQuery.lte('ordered_at', toJstRangeEnd(end))

  const { data: rawOrders, error: ordersError } = await ordersQuery

  if (ordersError) {
    throw new Error(ordersError.message)
  }

  const rawOrderRows = (rawOrders ?? []) as RawMobileOrderRow[]
  if (rawOrderRows.length === 0) {
    return { orders: [], items: [] }
  }

  const scheduleIds = Array.from(
    new Set(
      rawOrderRows
        .map((order) => order.schedule_id)
        .filter((value): value is string => Boolean(value))
    )
  )

  let scheduleDateMap = new Map<string, string>()
  if (scheduleIds.length > 0) {
    const { data: schedules, error: schedulesError } = await (supabase as any)
      .from('store_order_schedules')
      .select('id, business_date, notes')
      .in('id', scheduleIds)

    if (schedulesError) {
      throw new Error(schedulesError.message)
    }

    scheduleDateMap = new Map(
      ((schedules ?? []) as MobileOrderScheduleRow[]).map((row) => [row.id, row.business_date])
    )
    const scheduleContextMap = new Map(
      ((schedules ?? []) as MobileOrderScheduleRow[]).map((row) => [row.id, extractStoreOrderScheduleMetadata(row.notes)])
    )

    const normalizedOrders = rawOrderRows
      .filter(isCountableMobileOrder)
      .map((order): MobileOrderAnalyticsOrder | null => {
        const businessDate = scheduleDateMap.get(order.schedule_id) ?? toJstDate(order.ordered_at)
        const scheduleContext = scheduleContextMap.get(order.schedule_id) ?? { location_id: null, event_name: null }
        const fallbackEventId = resolveAnalyticsEventId(businessDate, null, stallLogByDate)
        const resolvedEventId = scheduleContext.event_name ? `schedule:${scheduleContext.event_name}` : fallbackEventId
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
          eventName: scheduleContext.event_name,
          locationId: scheduleContext.location_id ?? stallLogByDate.get(businessDate)?.locationId ?? null,
        } satisfies MobileOrderAnalyticsOrder
      })
      .filter((order): order is MobileOrderAnalyticsOrder => order != null)

    if (normalizedOrders.length === 0) {
      return { orders: [], items: [] }
    }

    const orderIds = normalizedOrders.map((order) => order.id)

    const { data: rawItems, error: itemsError } = await (supabase as any)
      .from('mobile_order_items')
      .select('id, order_id, product_id, product_name_snapshot, quantity, line_total_amount')
      .in('order_id', orderIds)

    if (itemsError) {
      throw new Error(itemsError.message)
    }

    const itemIds = ((rawItems ?? []) as Array<RawMobileOrderItemRow & { id: string }>).map((item) => item.id)
    const { data: optionChoiceRows, error: optionChoicesError } = itemIds.length
      ? await (supabase as any)
          .from('mobile_order_item_option_choices')
          .select('order_item_id, option_choice_name_snapshot, price_delta_snapshot')
          .in('order_item_id', itemIds)
      : { data: [], error: null }

    if (optionChoicesError) {
      throw new Error(optionChoicesError.message)
    }

    const optionChoicesByItemId = new Map<string, Array<{ optionChoiceName: string; priceDelta: number }>>()
    for (const row of ((optionChoiceRows ?? []) as Array<{
      order_item_id: string
      option_choice_name_snapshot: string
      price_delta_snapshot: number
    }>)) {
      const current = optionChoicesByItemId.get(row.order_item_id) ?? []
      current.push({
        optionChoiceName: row.option_choice_name_snapshot,
        priceDelta: row.price_delta_snapshot,
      })
      optionChoicesByItemId.set(row.order_item_id, current)
    }

    const items = ((rawItems ?? []) as Array<RawMobileOrderItemRow & { id: string }>).map((item) => ({
      orderId: item.order_id,
      productId: item.product_id,
      productName: item.product_name_snapshot,
      quantity: item.quantity ?? 0,
      lineTotalAmount: item.line_total_amount ?? 0,
      optionChoices: optionChoicesByItemId.get(item.id) ?? [],
    }))

    return {
      orders: normalizedOrders,
      items,
    }
  }

    const normalizedOrders = rawOrderRows
    .filter(isCountableMobileOrder)
    .map((order): MobileOrderAnalyticsOrder | null => {
      const businessDate = scheduleDateMap.get(order.schedule_id) ?? toJstDate(order.ordered_at)
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
        eventName: null,
        locationId: stallLogByDate.get(businessDate)?.locationId ?? null,
      } satisfies MobileOrderAnalyticsOrder
    })
    .filter((order): order is MobileOrderAnalyticsOrder => order != null)

  if (normalizedOrders.length === 0) {
    return { orders: [], items: [] }
  }

  const orderIds = normalizedOrders.map((order) => order.id)

  const { data: rawItems, error: itemsError } = await (supabase as any)
    .from('mobile_order_items')
    .select('order_id, product_id, product_name_snapshot, quantity, line_total_amount')
    .in('order_id', orderIds)

  if (itemsError) {
    throw new Error(itemsError.message)
  }

  const items = ((rawItems ?? []) as RawMobileOrderItemRow[]).map((item) => ({
    orderId: item.order_id,
    productId: item.product_id,
    productName: item.product_name_snapshot,
    quantity: item.quantity ?? 0,
    lineTotalAmount: item.line_total_amount ?? 0,
    optionChoices: [],
  }))

  return {
    orders: normalizedOrders,
    items,
  }
}
