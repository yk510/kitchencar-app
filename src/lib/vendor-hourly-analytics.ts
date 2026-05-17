import {
  buildStallLogResolutionMap,
  matchesAnalyticsScope,
  resolveAnalyticsEventId,
  type AnalyticsScopeFilter,
} from '@/lib/analytics-resolution'
import { fetchMobileOrderAnalyticsData } from '@/lib/mobile-order-analytics'
import {
  calculateCostFromProductMaster,
  loadProductMasterCostContext,
  resolveCostForMobileOrderOptionChoice,
  resolveCostForMobileOrderProduct,
} from '@/lib/product-master-links'

export type HourlyAnalyticsRow = {
  hour: number
  label: string
  total_sales: number
  total_cost: number
  gross_profit: number
  txn_count: number
  avg_sales_per_txn: number
  performance: 'high' | 'mid' | 'low'
}

export type VendorHourlyAnalyticsResult = {
  rows: HourlyAnalyticsRow[]
  heatmap: number[][]
}

function hourLabel(hour: number) {
  return `${String(hour).padStart(2, '0')}:00`
}

export async function getVendorHourlyAnalytics(
  supabase: any,
  userId: string,
  scope: AnalyticsScopeFilter,
  start?: string,
  end?: string
): Promise<VendorHourlyAnalyticsResult> {
  let txnQuery = (supabase as any)
    .from('transactions')
    .select('hour_of_day, total_amount, txn_no, event_id, txn_date')
    .eq('is_return', false)
  if (start) txnQuery = txnQuery.gte('txn_date', start)
  if (end) txnQuery = txnQuery.lte('txn_date', end)
  const { data: txns, error: txErr } = await txnQuery
  if (txErr) throw new Error(txErr.message)

  let salesQuery = (supabase as any)
    .from('product_sales')
    .select('product_name, quantity, event_id, txn_date, txn_no')
  if (start) salesQuery = salesQuery.gte('txn_date', start)
  if (end) salesQuery = salesQuery.lte('txn_date', end)
  const { data: sales, error: salesErr } = await salesQuery
  if (salesErr) throw new Error(salesErr.message)

  let stallLogsQuery = (supabase as any).from('stall_logs').select('log_date, event_id')
  if (start) stallLogsQuery = stallLogsQuery.gte('log_date', start)
  if (end) stallLogsQuery = stallLogsQuery.lte('log_date', end)
  const { data: stallLogs, error: stallLogsErr } = await stallLogsQuery
  if (stallLogsErr) throw new Error(stallLogsErr.message)

  const { data: costs, error: costsErr } = await (supabase as any)
    .from('product_master')
    .select('product_name, cost_amount')
  if (costsErr) throw new Error(costsErr.message)

  const costMap = new Map<string, number>()
  for (const c of (costs ?? []) as any[]) {
    if (c.cost_amount != null) costMap.set(c.product_name, c.cost_amount)
  }

  const stallLogByDate = buildStallLogResolutionMap((stallLogs ?? []) as any[])
  const mobileOrderAnalytics = await fetchMobileOrderAnalyticsData(supabase, { scope, start, end, stallLogByDate })
  const costContext = await loadProductMasterCostContext(supabase, userId)

  const txnHourMap = new Map<string, number>()
  const heatmap: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0))
  for (const t of (txns ?? []) as any[]) {
    const resolvedEventId = resolveAnalyticsEventId(t.txn_date, t.event_id, stallLogByDate)
    if (!matchesAnalyticsScope(scope, resolvedEventId)) continue
    if (t.txn_no && t.hour_of_day != null) txnHourMap.set(t.txn_no, t.hour_of_day)
  }

  const hourMap = new Map<number, { totalSales: number; totalCost: number; txnSet: Set<string> }>()
  for (let i = 0; i <= 23; i++) {
    hourMap.set(i, { totalSales: 0, totalCost: 0, txnSet: new Set<string>() })
  }

  for (const t of (txns ?? []) as any[]) {
    const resolvedEventId = resolveAnalyticsEventId(t.txn_date, t.event_id, stallLogByDate)
    if (!matchesAnalyticsScope(scope, resolvedEventId)) continue
    const hour = t.hour_of_day
    if (hour == null) continue
    const weekday = t.day_of_week
    const entry = hourMap.get(hour)
    if (!entry) continue
    entry.totalSales += t.total_amount ?? 0
    if (t.txn_no) entry.txnSet.add(t.txn_no)
    if (weekday != null) heatmap[weekday][hour] += t.total_amount ?? 0
  }

  for (const s of (sales ?? []) as any[]) {
    const resolvedEventId = resolveAnalyticsEventId(s.txn_date, s.event_id, stallLogByDate)
    if (!matchesAnalyticsScope(scope, resolvedEventId)) continue
    if (!s.txn_no) continue
    const hour = txnHourMap.get(s.txn_no)
    if (hour == null) continue
    const entry = hourMap.get(hour)
    if (!entry) continue
    const unitCost = costMap.get(s.product_name)
    if (unitCost != null) entry.totalCost += unitCost * (s.quantity ?? 0)
  }

  const mobileOrderMap = new Map(mobileOrderAnalytics.orders.map((order) => [order.id, order]))
  for (const order of mobileOrderAnalytics.orders) {
    const entry = hourMap.get(order.hourOfDay)
    if (!entry) continue
    entry.totalSales += order.totalAmount
    entry.txnSet.add(order.id)
    heatmap[order.dayOfWeek][order.hourOfDay] += order.totalAmount
  }
  for (const item of mobileOrderAnalytics.items) {
    const order = mobileOrderMap.get(item.orderId)
    if (!order) continue
    const entry = hourMap.get(order.hourOfDay)
    if (!entry) continue
    const linkedProductMaster = resolveCostForMobileOrderProduct(item.productId, item.productName, costContext)
    if (linkedProductMaster) {
      entry.totalCost += calculateCostFromProductMaster(linkedProductMaster, item.quantity, item.lineTotalAmount)
    } else {
      const unitCost = costMap.get(item.productName)
      if (unitCost != null) entry.totalCost += unitCost * item.quantity
    }
    for (const optionChoice of item.optionChoices) {
      const linkedOptionMaster = resolveCostForMobileOrderOptionChoice(null, optionChoice.optionChoiceName, costContext)
      entry.totalCost += calculateCostFromProductMaster(linkedOptionMaster, item.quantity, optionChoice.priceDelta * item.quantity)
    }
  }

  const rows = Array.from(hourMap.entries())
    .map(([hour, value]) => {
      const txnCount = value.txnSet.size
      const avgSalesPerTxn = txnCount > 0 ? Math.round(value.totalSales / txnCount) : 0
      return {
        hour,
        label: hourLabel(hour),
        total_sales: value.totalSales,
        total_cost: value.totalCost,
        gross_profit: value.totalSales - value.totalCost,
        txn_count: txnCount,
        avg_sales_per_txn: avgSalesPerTxn,
      }
    })
    .filter((row) => row.txn_count > 0)

  const sorted = [...rows].sort((a, b) => b.total_sales - a.total_sales)
  const total = sorted.length
  const perfMap = new Map<number, 'high' | 'mid' | 'low'>()
  sorted.forEach((row, i) => {
    let performance: 'high' | 'mid' | 'low'
    if (i < Math.ceil(total * 0.3)) performance = 'high'
    else if (i >= total - Math.ceil(total * 0.3)) performance = 'low'
    else performance = 'mid'
    perfMap.set(row.hour, performance)
  })

  return {
    rows: rows
      .map((row) => ({ ...row, performance: perfMap.get(row.hour) ?? 'mid' }))
      .sort((a, b) => a.hour - b.hour),
    heatmap,
  }
}
