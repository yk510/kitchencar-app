import { getDefaultHolidayFlag, getWeekdayLabel } from '@/lib/calendar'
import { resolveMobileOrderPaymentMethod } from '@/lib/mobile-order-fields'
import type { MobileOrderAnalyticsOrder } from '@/lib/mobile-order-analytics'
import type { VendorDailySalesRow } from '@/types/operations'

type TransactionLike = {
  txn_no: string
  txn_date: string
  total_amount: number | null
  location_id: string | null
  event_id: string | null
  payment_method: string | null
}

type ProductSaleLike = {
  txn_no: string
  txn_date: string
  quantity: number | null
}

type WeatherLogLike = {
  log_date: string
  location_id: string | null
  weather_type: string | null
  temperature_min: number | null
  temperature_max: number | null
}

type LocationLike = {
  id: string
  name: string
  address: string
}

type EventLike = {
  id: string
  event_name: string
}

type StallLogSummary = {
  locationId: string | null
  eventName: string | null
}

type MobileOrderAnalyticsItemLike = {
  orderId: string
  quantity: number
}

type DailyAccumulator = {
  date: string
  sales: number
  txnCount: number
  itemCount: number
  grossProfit: number
  cashSales: number
  paypaySales: number
  otherSales: number
  locationId: string | null
  eventName: string | null
}

function formatAverageTemperature(min: number | null, max: number | null) {
  if (min == null || max == null) return '-'
  return `${((min + max) / 2).toFixed(1)}℃`
}

export function normalizePaymentBucket(value: string | null | undefined): 'cash' | 'paypay' | 'other' {
  const normalized = String(value ?? '').normalize('NFKC').toLowerCase()
  if (!normalized) return 'other'
  if (normalized.includes('現金') || normalized === 'cash') return 'cash'
  if (normalized.includes('paypay')) return 'paypay'
  return 'other'
}

function createAccumulator(date: string, locationId: string | null, eventName: string | null): DailyAccumulator {
  return {
    date,
    sales: 0,
    txnCount: 0,
    itemCount: 0,
    grossProfit: 0,
    cashSales: 0,
    paypaySales: 0,
    otherSales: 0,
    locationId,
    eventName,
  }
}

export function buildVendorDailyAnalyticsRows(params: {
  txns: TransactionLike[]
  sales: ProductSaleLike[]
  weatherLogs: WeatherLogLike[]
  locations: LocationLike[]
  stallLogByDate: Map<string, StallLogSummary>
  mobileOrderOrders: MobileOrderAnalyticsOrder[]
  mobileOrderItems: MobileOrderAnalyticsItemLike[]
  grossProfitByTxnNo: Map<string, number>
  grossProfitByOrderId: Map<string, number>
  eventNameMap: Map<string, string>
}): VendorDailySalesRow[] {
  const {
    txns,
    sales,
    weatherLogs,
    locations,
    stallLogByDate,
    mobileOrderOrders,
    mobileOrderItems,
    grossProfitByTxnNo,
    grossProfitByOrderId,
    eventNameMap,
  } = params

  const locationMap = new Map<string, { name: string; address: string }>()
  for (const location of locations) {
    locationMap.set(location.id, {
      name: location.name,
      address: location.address,
    })
  }

  const weatherMap = new Map<
    string,
    { weather_type: string | null; temperature_min: number | null; temperature_max: number | null }
  >()
  for (const row of weatherLogs) {
    weatherMap.set(`${row.log_date}__${row.location_id ?? 'none'}`, {
      weather_type: row.weather_type,
      temperature_min: row.temperature_min,
      temperature_max: row.temperature_max,
    })
  }

  const rows = new Map<string, DailyAccumulator>()

  for (const txn of txns) {
    const date = txn.txn_date
    const stallLog = stallLogByDate.get(date)
    const current =
      rows.get(date) ??
      createAccumulator(
        date,
        stallLog?.locationId ?? txn.location_id ?? null,
        (txn.event_id ? eventNameMap.get(txn.event_id) ?? null : null) ?? stallLog?.eventName ?? null
      )

    current.sales += txn.total_amount ?? 0
    current.txnCount += 1
    current.grossProfit += (txn.total_amount ?? 0) - (grossProfitByTxnNo.get(txn.txn_no) ?? 0)

    const paymentBucket = normalizePaymentBucket(txn.payment_method)
    if (paymentBucket === 'cash') current.cashSales += txn.total_amount ?? 0
    else if (paymentBucket === 'paypay') current.paypaySales += txn.total_amount ?? 0
    else current.otherSales += txn.total_amount ?? 0

    if (!current.locationId) {
      current.locationId = txn.location_id ?? stallLog?.locationId ?? null
    }
    if (!current.eventName) {
      current.eventName = (txn.event_id ? eventNameMap.get(txn.event_id) ?? null : null) ?? stallLog?.eventName ?? null
    }

    rows.set(date, current)
  }

  for (const order of mobileOrderOrders) {
    const date = order.businessDate
    const stallLog = stallLogByDate.get(date)
    const current =
      rows.get(date) ??
      createAccumulator(date, order.locationId ?? stallLog?.locationId ?? null, order.eventName ?? stallLog?.eventName ?? null)

    if (!current.locationId) {
      current.locationId = order.locationId ?? stallLog?.locationId ?? null
    }
    if (!current.eventName) {
      current.eventName = order.eventName ?? stallLog?.eventName ?? null
    }

    current.sales += order.totalAmount
    current.txnCount += 1
    current.grossProfit += order.totalAmount - (grossProfitByOrderId.get(order.id) ?? 0)

    const paymentBucket = normalizePaymentBucket(resolveMobileOrderPaymentMethod(order))
    if (paymentBucket === 'cash') current.cashSales += order.totalAmount
    else if (paymentBucket === 'paypay') current.paypaySales += order.totalAmount
    else current.otherSales += order.totalAmount

    rows.set(date, current)
  }

  for (const row of sales) {
    const current = rows.get(row.txn_date)
    if (!current) continue
    current.itemCount += row.quantity ?? 0
  }

  const mobileOrderById = new Map(mobileOrderOrders.map((order) => [order.id, order]))
  for (const item of mobileOrderItems) {
    const order = mobileOrderById.get(item.orderId)
    if (!order) continue
    const current = rows.get(order.businessDate)
    if (!current) continue
    current.itemCount += item.quantity
  }

  return Array.from(rows.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((row) => {
      const location = row.locationId ? locationMap.get(row.locationId) : null
      const weather =
        weatherMap.get(`${row.date}__${row.locationId ?? 'none'}`) ??
        weatherMap.get(`${row.date}__none`) ??
        null

      return {
        date: row.date,
        weekday: getWeekdayLabel(row.date),
        holidayFlag: getDefaultHolidayFlag(row.date),
        locationName: location?.name ?? '-',
        eventName: row.eventName ?? '-',
        municipality: location?.address ?? '-',
        weatherType: weather?.weather_type ?? '-',
        avgTemperature: formatAverageTemperature(weather?.temperature_min ?? null, weather?.temperature_max ?? null),
        sales: row.sales,
        txnCount: row.txnCount,
        avgTicket: row.txnCount > 0 ? Math.round(row.sales / row.txnCount) : 0,
        itemCount: row.itemCount,
        avgItemPrice: row.itemCount > 0 ? Math.round(row.sales / row.itemCount) : 0,
        cashSales: row.cashSales,
        paypaySales: row.paypaySales,
        otherSales: row.otherSales,
        grossProfit: row.grossProfit,
      }
    })
}
