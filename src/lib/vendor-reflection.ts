import { buildStallLogResolutionMap } from '@/lib/analytics-resolution'
import { fetchMobileOrderAnalyticsData } from '@/lib/mobile-order-analytics'
import {
  calculateCostFromProductMaster,
  loadProductMasterCostContext,
  resolveCostForMobileOrderOptionChoice,
  resolveCostForMobileOrderProduct,
} from '@/lib/product-master-links'
import { buildVendorDailyAnalyticsRows } from '@/lib/vendor-daily-analytics-aggregate'
import type {
  VendorDailyMemo,
  VendorDailySalesRow,
  VendorWeekRange,
  VendorWeeklyReport,
} from '@/types/operations'

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function parseLocalDate(value: string) {
  return new Date(`${value}T00:00:00+09:00`)
}

export function getMonthRange(baseDate?: string) {
  if (baseDate) {
    const date = parseLocalDate(baseDate)
    const start = new Date(date.getFullYear(), date.getMonth(), 1)
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0)
    return {
      start: toIsoDate(start),
      end: toIsoDate(end),
    }
  }

  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return {
    start: toIsoDate(start),
    end: toIsoDate(end),
  }
}

export function getWeekRanges(start: string, end: string): VendorWeekRange[] {
  const startDate = parseLocalDate(start)
  const endDate = parseLocalDate(end)
  const cursor = new Date(startDate)
  const weeks: VendorWeekRange[] = []

  while (cursor <= endDate) {
    const weekStart = new Date(cursor)
    const day = weekStart.getDay()
    const diffToMonday = day === 0 ? -6 : 1 - day
    weekStart.setDate(weekStart.getDate() + diffToMonday)

    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 6)

    const clippedStart = weekStart < startDate ? startDate : weekStart
    const clippedEnd = weekEnd > endDate ? endDate : weekEnd
    const startIso = toIsoDate(clippedStart)
    const endIso = toIsoDate(clippedEnd)

    if (!weeks.some((item) => item.start === startIso && item.end === endIso)) {
      weeks.push({
        start: startIso,
        end: endIso,
        label: `${startIso} 〜 ${endIso}`,
      })
    }

    cursor.setDate(cursor.getDate() + 7)
  }

  return weeks
}

export async function getVendorDailyAnalytics(
  supabase: any,
  userId: string,
  start: string,
  end: string
): Promise<VendorDailySalesRow[]> {
  const costContextPromise = loadProductMasterCostContext(supabase, userId)
  const [
    { data: txns, error: txnError },
    { data: sales, error: salesError },
    { data: costs, error: costError },
    { data: weatherLogs, error: weatherError },
    { data: locations, error: locationError },
    { data: stallLogs, error: stallLogError },
    { data: events, error: eventError },
    costContext,
  ] = await Promise.all([
    (supabase as any)
      .from('transactions')
      .select('txn_no, txn_date, total_amount, location_id, event_id, payment_method')
      .eq('is_return', false)
      .gte('txn_date', start)
      .lte('txn_date', end)
      .order('txn_date', { ascending: true }),
    (supabase as any)
      .from('product_sales')
      .select('txn_no, txn_date, product_name, quantity')
      .gte('txn_date', start)
      .lte('txn_date', end),
    (supabase as any)
      .from('product_master')
      .select('product_name, cost_amount'),
    (supabase as any)
      .from('weather_logs')
      .select('log_date, location_id, weather_type, temperature_min, temperature_max')
      .gte('log_date', start)
      .lte('log_date', end),
    (supabase as any)
      .from('locations')
      .select('id, name, address'),
    (supabase as any)
      .from('stall_logs')
      .select('log_date, location_id, event_id')
      .gte('log_date', start)
      .lte('log_date', end),
    (supabase as any)
      .from('events')
      .select('id, event_name'),
    costContextPromise,
  ])

  if (txnError) throw new Error(txnError.message)
  if (salesError) throw new Error(salesError.message)
  if (costError) throw new Error(costError.message)
  if (weatherError) throw new Error(weatherError.message)
  if (locationError) throw new Error(locationError.message)
  if (stallLogError) throw new Error(stallLogError.message)
  if (eventError) throw new Error(eventError.message)

  const costMap = new Map<string, number>()
  for (const item of (costs ?? []) as any[]) {
    if (item.cost_amount != null) {
      costMap.set(item.product_name, item.cost_amount)
    }
  }

  const eventNameMap = new Map<string, string>()
  for (const event of (events ?? []) as any[]) {
    eventNameMap.set(event.id, event.event_name)
  }

  const grossProfitByTxnNo = new Map<string, number>()
  for (const row of (sales ?? []) as any[]) {
    const unitCost = costMap.get(row.product_name) ?? 0
    grossProfitByTxnNo.set(
      row.txn_no,
      (grossProfitByTxnNo.get(row.txn_no) ?? 0) + unitCost * (row.quantity ?? 0)
    )
  }

  const stallLogByDate = new Map<string, { locationId: string | null; eventName: string | null }>()
  for (const row of (stallLogs ?? []) as any[]) {
    stallLogByDate.set(row.log_date, {
      locationId: row.location_id ?? null,
      eventName: row.event_id ? eventNameMap.get(row.event_id) ?? null : null,
    })
  }

  const analyticsStallLogMap = buildStallLogResolutionMap((stallLogs ?? []) as any[])
  const mobileOrderAnalytics = await fetchMobileOrderAnalyticsData(supabase, {
    scope: 'all',
    start,
    end,
    stallLogByDate: analyticsStallLogMap,
  })

  const grossProfitByOrderId = new Map<string, number>()
  for (const item of mobileOrderAnalytics.items) {
    const linkedProductMaster = resolveCostForMobileOrderProduct(item.productId, item.productName, costContext)
    const optionCost = item.optionChoices.reduce((sum, optionChoice) => {
      const linkedOptionMaster = resolveCostForMobileOrderOptionChoice(
        null,
        optionChoice.optionChoiceName,
        costContext
      )
      return (
        sum +
        calculateCostFromProductMaster(
          linkedOptionMaster,
          item.quantity,
          optionChoice.priceDelta * item.quantity
        )
      )
    }, 0)
    grossProfitByOrderId.set(
      item.orderId,
      (grossProfitByOrderId.get(item.orderId) ?? 0) +
        calculateCostFromProductMaster(linkedProductMaster, item.quantity, item.lineTotalAmount) +
        optionCost
    )
  }

  return buildVendorDailyAnalyticsRows({
    txns: (txns ?? []) as any[],
    sales: (sales ?? []) as any[],
    weatherLogs: (weatherLogs ?? []) as any[],
    locations: (locations ?? []) as any[],
    stallLogByDate,
    mobileOrderOrders: mobileOrderAnalytics.orders,
    mobileOrderItems: mobileOrderAnalytics.items,
    grossProfitByTxnNo,
    grossProfitByOrderId,
    eventNameMap,
  })
}

export async function getVendorDailyMemos(supabase: any, start: string, end: string): Promise<VendorDailyMemo[]> {
  const { data, error } = await (supabase as any)
    .from('vendor_daily_memos')
    .select('id, memo_date, memo_text, created_at, updated_at')
    .gte('memo_date', start)
    .lte('memo_date', end)
    .order('memo_date', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as VendorDailyMemo[]
}

export async function getVendorWeeklyReports(
  supabase: any,
  start: string,
  end: string
): Promise<VendorWeeklyReport[]> {
  const { data, error } = await (supabase as any)
    .from('vendor_weekly_reports')
    .select('*')
    .lte('week_start_date', end)
    .gte('week_end_date', start)
    .order('week_start_date', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as VendorWeeklyReport[]
}
