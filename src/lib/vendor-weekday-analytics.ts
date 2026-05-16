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

const DAY_LABELS = ['月', '火', '水', '木', '金', '土', '日']

function weekdayLabel(day: number) {
  return DAY_LABELS[day] ?? '-'
}

export type WeekdayAnalyticsRow = {
  day: number
  label: string
  total_sales: number
  total_cost: number
  gross_profit: number
  avg_sales: number
  avg_sales_per_txn: number
  day_count: number
  txn_count: number
  performance: 'high' | 'mid' | 'low'
}

export async function getVendorWeekdayAnalytics(
  supabase: any,
  userId: string,
  scope: AnalyticsScopeFilter,
  start?: string,
  end?: string
): Promise<WeekdayAnalyticsRow[]> {
  let txnQuery = (supabase as any)
    .from('transactions')
    .select('day_of_week, total_amount, txn_date, event_id, txn_no')
    .eq('is_return', false)
  if (start) txnQuery = txnQuery.gte('txn_date', start)
  if (end) txnQuery = txnQuery.lte('txn_date', end)
  const { data: txns, error: txErr } = await txnQuery
  if (txErr) throw new Error(txErr.message)

  let salesQuery = (supabase as any)
    .from('product_sales')
    .select('product_name, quantity, txn_date, event_id')
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

  const weekdayMap = new Map<number, { totalSales: number; totalCost: number; days: Set<string>; txnSet: Set<string> }>()
  for (let i = 0; i <= 6; i++) {
    weekdayMap.set(i, { totalSales: 0, totalCost: 0, days: new Set<string>(), txnSet: new Set<string>() })
  }

  for (const t of (txns ?? []) as any[]) {
    const resolvedEventId = resolveAnalyticsEventId(t.txn_date, t.event_id, stallLogByDate)
    if (!matchesAnalyticsScope(scope, resolvedEventId)) continue
    const day = t.day_of_week
    if (day == null) continue
    const entry = weekdayMap.get(day)
    if (!entry) continue
    entry.totalSales += t.total_amount ?? 0
    if (t.txn_date) entry.days.add(t.txn_date)
    if (t.txn_no) entry.txnSet.add(t.txn_no)
  }

  for (const s of (sales ?? []) as any[]) {
    const resolvedEventId = resolveAnalyticsEventId(s.txn_date, s.event_id, stallLogByDate)
    if (!matchesAnalyticsScope(scope, resolvedEventId)) continue
    if (!s.txn_date) continue
    const day = new Date(`${s.txn_date}T00:00:00`).getDay()
    const entry = weekdayMap.get(day)
    if (!entry) continue
    const unitCost = costMap.get(s.product_name)
    if (unitCost != null) entry.totalCost += unitCost * (s.quantity ?? 0)
  }

  const mobileOrderMap = new Map(mobileOrderAnalytics.orders.map((order) => [order.id, order]))
  for (const order of mobileOrderAnalytics.orders) {
    const entry = weekdayMap.get(order.dayOfWeek)
    if (!entry) continue
    entry.totalSales += order.totalAmount
    entry.days.add(order.businessDate)
    entry.txnSet.add(order.id)
  }
  for (const item of mobileOrderAnalytics.items) {
    const order = mobileOrderMap.get(item.orderId)
    if (!order) continue
    const entry = weekdayMap.get(order.dayOfWeek)
    if (!entry) continue
    const linkedProductMaster = resolveCostForMobileOrderProduct(item.productId, item.productName, costContext)
    if (linkedProductMaster) {
      entry.totalCost += calculateCostFromProductMaster(linkedProductMaster, item.quantity, item.lineTotalAmount)
    }
    for (const optionChoice of item.optionChoices) {
      const linkedOptionMaster = resolveCostForMobileOrderOptionChoice(null, optionChoice.optionChoiceName, costContext)
      entry.totalCost += calculateCostFromProductMaster(linkedOptionMaster, item.quantity, optionChoice.priceDelta * item.quantity)
    }
  }

  const rows = Array.from(weekdayMap.entries()).map(([day, value]) => {
    const dayCount = value.days.size
    const txnCount = value.txnSet.size
    const avgSales = dayCount > 0 ? Math.round(value.totalSales / dayCount) : 0
    const avgSalesPerTxn = txnCount > 0 ? Math.round(value.totalSales / txnCount) : 0
    return {
      day,
      label: weekdayLabel(day),
      total_sales: value.totalSales,
      total_cost: value.totalCost,
      gross_profit: value.totalSales - value.totalCost,
      avg_sales: avgSales,
      avg_sales_per_txn: avgSalesPerTxn,
      day_count: dayCount,
      txn_count: txnCount,
    }
  })

  const sorted = [...rows].sort((a, b) => b.avg_sales - a.avg_sales)
  const total = sorted.length
  const perfMap = new Map<number, 'high' | 'mid' | 'low'>()
  sorted.forEach((row, i) => {
    let performance: 'high' | 'mid' | 'low'
    if (i < Math.ceil(total * 0.3)) performance = 'high'
    else if (i >= total - Math.ceil(total * 0.3)) performance = 'low'
    else performance = 'mid'
    perfMap.set(row.day, performance)
  })

  return rows
    .map((row) => ({ ...row, performance: perfMap.get(row.day) ?? 'mid' }))
    .sort((a, b) => a.day - b.day)
}
