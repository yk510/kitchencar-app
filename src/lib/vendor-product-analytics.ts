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

export function normalizeAnalyticsScope(scope?: string): AnalyticsScopeFilter {
  if (scope === 'normal') return 'normal'
  if (scope === 'event') return 'event'
  return 'all'
}

export type ProductAnalyticsRow = {
  product_name: string
  total_sales: number
  total_qty: number
  txn_count: number
  avg_sales_per_txn: number
  avg_price: number
  profit: number | null
  profit_rate: number | null
  cost_amount: number | null
  cost_rate_reg: number | null
  has_cost: boolean
  is_top3: boolean
  is_low_margin: boolean
}

export async function getVendorProductAnalytics(
  supabase: any,
  userId: string,
  scope: AnalyticsScopeFilter,
  start?: string,
  end?: string
): Promise<ProductAnalyticsRow[]> {
  let salesQuery = (supabase as any)
    .from('product_sales')
    .select('product_name, unit_price, quantity, subtotal, event_id, txn_date, txn_no')

  if (start) salesQuery = salesQuery.gte('txn_date', start)
  if (end) salesQuery = salesQuery.lte('txn_date', end)

  const { data: sales, error: saleErr } = await salesQuery
  if (saleErr) throw new Error(saleErr.message)

  let stallLogsQuery = (supabase as any).from('stall_logs').select('log_date, event_id')
  if (start) stallLogsQuery = stallLogsQuery.gte('log_date', start)
  if (end) stallLogsQuery = stallLogsQuery.lte('log_date', end)

  const { data: stallLogs, error: stallLogsErr } = await stallLogsQuery
  if (stallLogsErr) throw new Error(stallLogsErr.message)

  const { data: costs, error: costsErr } = await (supabase as any)
    .from('product_master')
    .select('product_name, cost_amount, cost_rate')
  if (costsErr) throw new Error(costsErr.message)

  const costMap = new Map<string, { cost_amount: number | null; cost_rate: number | null }>()
  for (const c of (costs ?? []) as any[]) {
    costMap.set(c.product_name, { cost_amount: c.cost_amount, cost_rate: c.cost_rate })
  }

  const stallLogByDate = buildStallLogResolutionMap((stallLogs ?? []) as any[])
  const mobileOrderAnalytics = await fetchMobileOrderAnalyticsData(supabase, {
    scope,
    start,
    end,
    stallLogByDate,
  })
  const costContext = await loadProductMasterCostContext(supabase, userId)

  const productMap = new Map<
    string,
    {
      total_sales: number
      total_qty: number
      total_cost: number
      has_cost: boolean
      txnSet: Set<string>
    }
  >()

  for (const s of (sales ?? []) as any[]) {
    const resolvedEventId = resolveAnalyticsEventId(s.txn_date, s.event_id, stallLogByDate)
    if (!matchesAnalyticsScope(scope, resolvedEventId)) continue

    const entry = productMap.get(s.product_name) ?? {
      total_sales: 0,
      total_qty: 0,
      total_cost: 0,
      has_cost: false,
      txnSet: new Set<string>(),
    }
    entry.total_sales += s.subtotal ?? 0
    entry.total_qty += s.quantity ?? 0
    if (s.txn_no) entry.txnSet.add(s.txn_no)

    const costInfo = costMap.get(s.product_name)
    if (costInfo) {
      if (costInfo.cost_amount != null) {
        entry.total_cost += costInfo.cost_amount * (s.quantity ?? 0)
        entry.has_cost = true
      } else if (costInfo.cost_rate != null) {
        entry.total_cost += ((s.subtotal ?? 0) * costInfo.cost_rate) / 100
        entry.has_cost = true
      }
    }
    productMap.set(s.product_name, entry)
  }

  const mobileOrderMap = new Map(mobileOrderAnalytics.orders.map((order) => [order.id, order]))
  for (const item of mobileOrderAnalytics.items) {
    const order = mobileOrderMap.get(item.orderId)
    if (!order) continue

    const entry = productMap.get(item.productName) ?? {
      total_sales: 0,
      total_qty: 0,
      total_cost: 0,
      has_cost: false,
      txnSet: new Set<string>(),
    }
    entry.total_sales += item.lineTotalAmount
    entry.total_qty += item.quantity
    entry.txnSet.add(order.id)

    const linkedProductMaster = resolveCostForMobileOrderProduct(item.productId, item.productName, costContext)
    if (linkedProductMaster) {
      entry.total_cost += calculateCostFromProductMaster(linkedProductMaster, item.quantity, item.lineTotalAmount)
      entry.has_cost = true
    }
    let optionCost = 0
    for (const optionChoice of item.optionChoices) {
      const linkedOptionMaster = resolveCostForMobileOrderOptionChoice(null, optionChoice.optionChoiceName, costContext)
      optionCost += calculateCostFromProductMaster(linkedOptionMaster, item.quantity, optionChoice.priceDelta * item.quantity)
    }
    if (optionCost > 0) {
      entry.total_cost += optionCost
      entry.has_cost = true
    }
    productMap.set(item.productName, entry)
  }

  const sorted = Array.from(productMap.entries()).sort((a, b) => b[1].total_sales - a[1].total_sales)

  return sorted.map(([name, e], i) => {
    const avgPrice = e.total_qty > 0 ? Math.round(e.total_sales / e.total_qty) : 0
    const txnCount = e.txnSet.size
    const avgSalesPerTxn = txnCount > 0 ? Math.round(e.total_sales / txnCount) : 0
    const profit = e.has_cost ? e.total_sales - e.total_cost : null
    const profitRate = e.has_cost && e.total_sales > 0 ? Math.round(((e.total_sales - e.total_cost) / e.total_sales) * 100) : null
    const costInfo = costMap.get(name)

    return {
      product_name: name,
      total_sales: e.total_sales,
      total_qty: e.total_qty,
      txn_count: txnCount,
      avg_sales_per_txn: avgSalesPerTxn,
      avg_price: avgPrice,
      cost_amount: costInfo?.cost_amount ?? null,
      cost_rate_reg: costInfo?.cost_rate ?? null,
      profit,
      profit_rate: profitRate,
      has_cost: e.has_cost,
      is_top3: i < 3,
      is_low_margin: profitRate != null && profitRate < 50,
    }
  })
}
