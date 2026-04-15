import AnalyticsPageHeader from '@/components/AnalyticsPageHeader'
import { AnalyticsScope } from '@/components/AnalyticsScopeTabs'
import { requireServerSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

function normalizeScope(scope?: string): AnalyticsScope {
  if (scope === 'normal') return 'normal'
  if (scope === 'event') return 'event'
  return 'all'
}

function weekdayLabel(day: number) {
  const labels = ['日', '月', '火', '水', '木', '金', '土']
  return labels[day] ?? '-'
}

async function getWeekdayAnalytics(
  supabase: any,
  scope: AnalyticsScope,
  start?: string,
  end?: string
) {
  let txnQuery = (supabase as any)
    .from('transactions')
    .select('day_of_week, total_amount, txn_date, event_id, txn_no')
    .eq('is_return', false)

  if (scope === 'normal') txnQuery = txnQuery.is('event_id', null)
  else if (scope === 'event') txnQuery = txnQuery.not('event_id', 'is', null)

  if (start) txnQuery = txnQuery.gte('txn_date', start)
  if (end) txnQuery = txnQuery.lte('txn_date', end)

  const { data: txns, error: txErr } = await txnQuery
  if (txErr) throw new Error(txErr.message)

  let salesQuery = (supabase as any)
    .from('product_sales')
    .select('product_name, quantity, txn_date, event_id')

  if (scope === 'normal') salesQuery = salesQuery.is('event_id', null)
  else if (scope === 'event') salesQuery = salesQuery.not('event_id', 'is', null)

  if (start) salesQuery = salesQuery.gte('txn_date', start)
  if (end) salesQuery = salesQuery.lte('txn_date', end)

  const { data: sales, error: salesErr } = await salesQuery
  if (salesErr) throw new Error(salesErr.message)

  const { data: costs, error: costsErr } = await (supabase as any)
    .from('product_master')
    .select('product_name, cost_amount')
  if (costsErr) throw new Error(costsErr.message)

  const costMap = new Map<string, number>()
  for (const c of ((costs ?? []) as any[])) {
    if (c.cost_amount != null) costMap.set(c.product_name, c.cost_amount)
  }

  const weekdayMap = new Map<
    number,
    {
      totalSales: number
      totalCost: number
      days: Set<string>
      txnSet: Set<string>
    }
  >()

  for (let i = 0; i <= 6; i++) {
    weekdayMap.set(i, {
      totalSales: 0,
      totalCost: 0,
      days: new Set<string>(),
      txnSet: new Set<string>(),
    })
  }

  for (const t of ((txns ?? []) as any[])) {
    const day = t.day_of_week
    if (day == null) continue

    const entry = weekdayMap.get(day)
    if (!entry) continue

    entry.totalSales += t.total_amount ?? 0
    if (t.txn_date) entry.days.add(t.txn_date)
    if (t.txn_no) entry.txnSet.add(t.txn_no)
  }

  for (const s of ((sales ?? []) as any[])) {
    if (!s.txn_date) continue
    const day = new Date(`${s.txn_date}T00:00:00`).getDay()
    const entry = weekdayMap.get(day)
    if (!entry) continue

    const unitCost = costMap.get(s.product_name)
    if (unitCost != null) {
      entry.totalCost += unitCost * (s.quantity ?? 0)
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

  const ranked = sorted.map((row, i) => {
    let performance: 'high' | 'mid' | 'low'
    if (i < Math.ceil(total * 0.3)) performance = 'high'
    else if (i >= total - Math.ceil(total * 0.3)) performance = 'low'
    else performance = 'mid'
    return { ...row, performance }
  })

  const perfMap = new Map<number, 'high' | 'mid' | 'low'>()
  for (const row of ranked) perfMap.set(row.day, row.performance)

  return rows
    .map((row) => ({
      ...row,
      performance: perfMap.get(row.day) ?? 'mid',
    }))
    .sort((a, b) => a.day - b.day)
}

export default async function WeekdayAnalyticsPage({
  searchParams,
}: {
  searchParams?: { scope?: string; start?: string; end?: string }
}) {
  const { supabase } = await requireServerSession()
  const scope = normalizeScope(searchParams?.scope)
  const start = searchParams?.start
  const end = searchParams?.end

  const data = await getWeekdayAnalytics(supabase, scope, start, end)

  const scopeLabel =
    scope === 'normal' ? '通常出店のみ' : scope === 'event' ? 'イベント出店のみ' : '全体'

  return (
    <div>
      <AnalyticsPageHeader
        title="曜日別分析"
        description="平均売上をもとに曜日ごとの傾向を表示します。"
        scopeLabel={scopeLabel}
        basePath="/analytics/weekday"
        currentScope={scope}
        currentStart={start}
        currentEnd={end}
      />

      {data.length === 0 ? (
        <div className="soft-panel text-center py-20">
          <p className="section-subtitle">この条件に一致するデータがありません。</p>
        </div>
      ) : (
        <div className="space-y-4">
          {data.map((row) => {
            const style =
              row.performance === 'high'
                ? { card: 'bg-green-50 border-green-200', badge: 'badge-soft badge-green', icon: '😊' }
                : row.performance === 'low'
                ? { card: 'bg-red-50 border-red-200', badge: 'badge-soft bg-red-100 text-red-800', icon: '🌀' }
                : { card: 'bg-white border-soft', badge: 'badge-soft bg-gray-100 text-gray-700', icon: '📅' }

            return (
              <div key={row.day} className={`soft-card p-5 ${style.card}`}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{style.icon}</span>
                      <span className={style.badge}>
                        {row.performance === 'high' ? '強い曜日' : row.performance === 'low' ? '弱い曜日' : '中間'}
                      </span>
                    </div>
                    <h2 className="text-lg font-semibold text-main">{row.label}曜日</h2>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-right">
                    <div className="rounded-2xl bg-white/70 border border-white p-3">
                      <p className="text-xs text-sub">出店日数</p>
                      <p className="font-bold text-main">{row.day_count} 日</p>
                    </div>
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
      )}
    </div>
  )
}
