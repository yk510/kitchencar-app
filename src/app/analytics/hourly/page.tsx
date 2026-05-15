import { Suspense } from 'react'
import AnalyticsLoadingSkeleton from '@/components/AnalyticsLoadingSkeleton'
import AnalyticsPageHeader from '@/components/AnalyticsPageHeader'
import { AnalyticsScope } from '@/components/AnalyticsScopeTabs'
import { requireServerSession } from '@/lib/auth'
import { normalizeAnalyticsDate } from '@/lib/analytics-date'
import {
  buildStallLogResolutionMap,
  matchesAnalyticsScope,
  resolveAnalyticsEventId,
} from '@/lib/analytics-resolution'
import { fetchMobileOrderAnalyticsData } from '@/lib/mobile-order-analytics'
import {
  calculateCostFromProductMaster,
  loadProductMasterCostContext,
  resolveCostForMobileOrderOptionChoice,
  resolveCostForMobileOrderProduct,
} from '@/lib/product-master-links'

export const dynamic = 'force-dynamic'

function normalizeScope(scope?: string): AnalyticsScope {
  if (scope === 'normal') return 'normal'
  if (scope === 'event') return 'event'
  return 'all'
}

function hourLabel(hour: number) {
  return `${String(hour).padStart(2, '0')}:00`
}

async function getHourlyAnalytics(
  supabase: any,
  userId: string,
  scope: AnalyticsScope,
  start?: string,
  end?: string
) {
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

  let stallLogsQuery = (supabase as any)
    .from('stall_logs')
    .select('log_date, event_id')

  if (start) stallLogsQuery = stallLogsQuery.gte('log_date', start)
  if (end) stallLogsQuery = stallLogsQuery.lte('log_date', end)

  const { data: stallLogs, error: stallLogsErr } = await stallLogsQuery
  if (stallLogsErr) throw new Error(stallLogsErr.message)

  const { data: costs, error: costsErr } = await (supabase as any)
    .from('product_master')
    .select('product_name, cost_amount')
  if (costsErr) throw new Error(costsErr.message)

  const costMap = new Map<string, number>()
  for (const c of ((costs ?? []) as any[])) {
    if (c.cost_amount != null) costMap.set(c.product_name, c.cost_amount)
  }

  const stallLogByDate = buildStallLogResolutionMap((stallLogs ?? []) as any[])
  const mobileOrderAnalytics = await fetchMobileOrderAnalyticsData(supabase, {
    scope,
    start,
    end,
    stallLogByDate,
  })
  const costContext = await loadProductMasterCostContext(supabase, userId)

  const txnHourMap = new Map<string, number>()
  for (const t of ((txns ?? []) as any[])) {
    const resolvedEventId = resolveAnalyticsEventId(t.txn_date, t.event_id, stallLogByDate)
    if (!matchesAnalyticsScope(scope, resolvedEventId)) continue
    if (t.txn_no && t.hour_of_day != null) {
      txnHourMap.set(t.txn_no, t.hour_of_day)
    }
  }

  const hourMap = new Map<
    number,
    {
      totalSales: number
      totalCost: number
      txnSet: Set<string>
    }
  >()

  for (let i = 0; i <= 23; i++) {
    hourMap.set(i, {
      totalSales: 0,
      totalCost: 0,
      txnSet: new Set<string>(),
    })
  }

  for (const t of ((txns ?? []) as any[])) {
    const resolvedEventId = resolveAnalyticsEventId(t.txn_date, t.event_id, stallLogByDate)
    if (!matchesAnalyticsScope(scope, resolvedEventId)) continue

    const hour = t.hour_of_day
    if (hour == null) continue

    const entry = hourMap.get(hour)
    if (!entry) continue

    entry.totalSales += t.total_amount ?? 0
    if (t.txn_no) entry.txnSet.add(t.txn_no)
  }

  for (const s of ((sales ?? []) as any[])) {
    const resolvedEventId = resolveAnalyticsEventId(s.txn_date, s.event_id, stallLogByDate)
    if (!matchesAnalyticsScope(scope, resolvedEventId)) continue

    if (!s.txn_no) continue
    const hour = txnHourMap.get(s.txn_no)
    if (hour == null) continue

    const entry = hourMap.get(hour)
    if (!entry) continue

    const unitCost = costMap.get(s.product_name)
    if (unitCost != null) {
      entry.totalCost += unitCost * (s.quantity ?? 0)
    }
  }

  const mobileOrderMap = new Map(mobileOrderAnalytics.orders.map((order) => [order.id, order]))

  for (const order of mobileOrderAnalytics.orders) {
    const entry = hourMap.get(order.hourOfDay)
    if (!entry) continue

    entry.totalSales += order.totalAmount
    entry.txnSet.add(order.id)
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
      if (unitCost != null) {
        entry.totalCost += unitCost * item.quantity
      }
    }

    for (const optionChoice of item.optionChoices) {
      const linkedOptionMaster = resolveCostForMobileOrderOptionChoice(
        null,
        optionChoice.optionChoiceName,
        costContext
      )
      entry.totalCost += calculateCostFromProductMaster(
        linkedOptionMaster,
        item.quantity,
        optionChoice.priceDelta * item.quantity
      )
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

  const ranked = sorted.map((row, i) => {
    let performance: 'high' | 'mid' | 'low'
    if (i < Math.ceil(total * 0.3)) performance = 'high'
    else if (i >= total - Math.ceil(total * 0.3)) performance = 'low'
    else performance = 'mid'
    return { ...row, performance }
  })

  const perfMap = new Map<number, 'high' | 'mid' | 'low'>()
  for (const row of ranked) perfMap.set(row.hour, row.performance)

  return rows
    .map((row) => ({
      ...row,
      performance: perfMap.get(row.hour) ?? 'mid',
    }))
    .sort((a, b) => a.hour - b.hour)
}

async function HourlyAnalyticsContent({
  scope,
  start,
  end,
}: {
  scope: AnalyticsScope
  start?: string
  end?: string
}) {
  const { supabase, user } = await requireServerSession({ includeProfile: false })
  const data = await getHourlyAnalytics(supabase, user.id, scope, start, end)

  if (data.length === 0) {
    return (
      <div className="soft-panel text-center py-20">
        <p className="section-subtitle">この条件に一致するデータがありません。</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {data.map((row) => {
        const style =
          row.performance === 'high'
            ? { card: 'bg-green-50 border-green-200', badge: 'badge-soft badge-green', icon: '⏰' }
            : row.performance === 'low'
            ? { card: 'bg-red-50 border-red-200', badge: 'badge-soft bg-red-100 text-red-800', icon: '🫥' }
            : { card: 'bg-white border-soft', badge: 'badge-soft bg-gray-100 text-gray-700', icon: '🕒' }

        return (
          <div key={row.hour} className={`soft-card p-5 ${style.card}`}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{style.icon}</span>
                  <span className={style.badge}>
                    {row.performance === 'high' ? '強い時間帯' : row.performance === 'low' ? '弱い時間帯' : '中間'}
                  </span>
                </div>
                <h2 className="text-lg font-semibold text-main">{row.label}</h2>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-right">
                <div className="rounded-2xl bg-white/70 border border-white p-3">
                  <p className="text-xs text-sub">取引数</p>
                  <p className="font-bold text-main">{row.txn_count} 件</p>
                </div>
                <div className="rounded-2xl bg-white/70 border border-white p-3">
                  <p className="text-xs text-sub">平均取引単価</p>
                  <p className="font-bold text-blue-700">{row.avg_sales_per_txn.toLocaleString()} 円</p>
                </div>
                <div className="rounded-2xl bg-white/70 border border-white p-3">
                  <p className="text-xs text-sub">累計売上</p>
                  <p className="font-bold text-main">{row.total_sales.toLocaleString()} 円</p>
                </div>
                <div className="rounded-2xl bg-white/70 border border-white p-3">
                  <p className="text-xs text-sub">推定粗利</p>
                  <p className={`font-bold ${row.gross_profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {row.gross_profit.toLocaleString()} 円
                  </p>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default async function HourlyAnalyticsPage({
  searchParams,
}: {
  searchParams?: { scope?: string; start?: string; end?: string }
}) {
  const scope = normalizeScope(searchParams?.scope)
  const start = normalizeAnalyticsDate(searchParams?.start)
  const end = normalizeAnalyticsDate(searchParams?.end)

  const scopeLabel =
    scope === 'normal' ? '通常出店のみ' : scope === 'event' ? 'イベント出店のみ' : '全体'

  return (
    <div>
      <AnalyticsPageHeader
        title="時間帯別分析"
        description="売上と取引件数をもとに、時間帯ごとの傾向を表示します。"
        scopeLabel={scopeLabel}
        basePath="/analytics/hourly"
        currentScope={scope}
        currentStart={start}
        currentEnd={end}
      />
      <Suspense fallback={<AnalyticsLoadingSkeleton />}>
        <HourlyAnalyticsContent scope={scope} start={start} end={end} />
      </Suspense>
    </div>
  )
}
