import { supabase } from '@/lib/supabase'
import AnalyticsPageHeader from '@/components/AnalyticsPageHeader'
import { AnalyticsScope } from '@/components/AnalyticsScopeTabs'

export const dynamic = 'force-dynamic'

function normalizeScope(scope?: string): AnalyticsScope {
  if (scope === 'normal') return 'normal'
  if (scope === 'event') return 'event'
  return 'all'
}

async function getLocationAnalytics(
  scope: AnalyticsScope,
  start?: string,
  end?: string
) {
  const { data: locations, error: locErr } = await (supabase as any)
    .from('locations')
    .select('id, name')

  if (locErr) throw new Error(locErr.message)

  let txnQuery = (supabase as any)
    .from('transactions')
    .select('location_id, total_amount, txn_date, event_id, txn_no')
    .eq('is_return', false)

  if (scope === 'normal') {
    txnQuery = txnQuery.is('event_id', null)
  } else if (scope === 'event') {
    txnQuery = txnQuery.not('event_id', 'is', null)
  }

  if (start) txnQuery = txnQuery.gte('txn_date', start)
  if (end) txnQuery = txnQuery.lte('txn_date', end)

  const { data: txns, error: txErr } = await txnQuery
  if (txErr) throw new Error(txErr.message)

  let salesQuery = (supabase as any)
    .from('product_sales')
    .select('location_id, product_name, quantity, event_id, txn_date')

  if (start) salesQuery = salesQuery.gte('txn_date', start)
  if (end) salesQuery = salesQuery.lte('txn_date', end)

  const { data: sales, error: salesErr } = await salesQuery
  if (salesErr) throw new Error(salesErr.message)

  const { data: costs, error: costsErr } = await (supabase as any)
    .from('product_master')
    .select('product_name, cost_amount')

  if (costsErr) throw new Error(costsErr.message)

  let weatherQuery = (supabase as any)
    .from('weather_logs')
    .select('location_id, weather_type, log_date')

  if (start) weatherQuery = weatherQuery.gte('log_date', start)
  if (end) weatherQuery = weatherQuery.lte('log_date', end)

  const { data: weather, error: weatherErr } = await weatherQuery
  if (weatherErr) throw new Error(weatherErr.message)

  const filteredSales =
    scope === 'all'
      ? (sales ?? [])
      : ((sales ?? []) as any[]).filter((s: any) =>
          scope === 'normal' ? s.event_id == null : s.event_id != null
        )

  const costMap = new Map<string, number>()
  for (const c of ((costs ?? []) as any[])) {
    if (c.cost_amount != null) {
      costMap.set(c.product_name, c.cost_amount)
    }
  }

  const locMap = new Map<
    string,
    {
      name: string
      total_sales: number
      days: Set<string>
      txnSet: Set<string>
      total_cost: number
      weather_counts: Record<string, number>
    }
  >()

  for (const loc of ((locations ?? []) as any[])) {
    locMap.set(loc.id, {
      name: loc.name,
      total_sales: 0,
      days: new Set(),
      txnSet: new Set(),
      total_cost: 0,
      weather_counts: {},
    })
  }

  for (const t of ((txns ?? []) as any[])) {
    if (!t.location_id) continue
    const entry = locMap.get(t.location_id)
    if (!entry) continue

    entry.total_sales += t.total_amount ?? 0
    if (t.txn_date) entry.days.add(t.txn_date)
    if (t.txn_no) entry.txnSet.add(t.txn_no)
  }

  for (const s of filteredSales as any[]) {
    if (!s.location_id) continue
    const entry = locMap.get(s.location_id)
    if (!entry) continue

    const unitCost = costMap.get(s.product_name)
    if (unitCost != null) {
      entry.total_cost += unitCost * (s.quantity ?? 0)
    }
  }

  for (const w of ((weather ?? []) as any[])) {
    if (!w.location_id) continue
    const entry = locMap.get(w.location_id)
    if (!entry) continue

    entry.weather_counts[w.weather_type] =
      (entry.weather_counts[w.weather_type] ?? 0) + 1
  }

  const rows = Array.from(locMap.entries())
    .map(([id, e]) => {
      const dayCount = e.days.size
      const txnCount = e.txnSet.size
      const avgSales = dayCount > 0 ? Math.round(e.total_sales / dayCount) : 0
      const avgSalesPerTxn = txnCount > 0 ? Math.round(e.total_sales / txnCount) : 0
      const grossProfit = e.total_sales - e.total_cost
      const mainWeather =
        Object.entries(e.weather_counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '-'

      return {
        id,
        name: e.name,
        day_count: dayCount,
        txn_count: txnCount,
        avg_sales: avgSales,
        avg_sales_per_txn: avgSalesPerTxn,
        total_sales: e.total_sales,
        gross_profit: grossProfit,
        main_weather: mainWeather,
      }
    })
    .filter((r) => r.day_count > 0)
    .sort((a, b) => b.avg_sales - a.avg_sales)

  const total = rows.length
  return rows.map((r, i) => {
    let performance: 'high' | 'mid' | 'low'
    if (i < Math.ceil(total * 0.3)) performance = 'high'
    else if (i >= total - Math.ceil(total * 0.3)) performance = 'low'
    else performance = 'mid'
    return { ...r, performance }
  })
}

export default async function LocationAnalyticsPage({
  searchParams,
}: {
  searchParams?: { scope?: string; start?: string; end?: string }
}) {
  const scope = normalizeScope(searchParams?.scope)
  const start = searchParams?.start
  const end = searchParams?.end

  const data = await getLocationAnalytics(scope, start, end)

  const scopeLabel =
    scope === 'normal'
      ? '通常出店のみ'
      : scope === 'event'
      ? 'イベント出店のみ'
      : '全体'

  return (
    <div>
      <AnalyticsPageHeader
        title="出店場所別分析"
        description="平均売上をもとに場所ごとの傾向を表示します。"
        scopeLabel={scopeLabel}
        basePath="/analytics/locations"
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
          {data.map((row: any) => {
            const style =
              row.performance === 'high'
                ? { card: 'bg-green-50 border-green-200', badge: 'badge-soft badge-green', icon: '🌟' }
                : row.performance === 'low'
                ? { card: 'bg-red-50 border-red-200', badge: 'badge-soft bg-red-100 text-red-800', icon: '👀' }
                : { card: 'bg-white border-soft', badge: 'badge-soft bg-gray-100 text-gray-700', icon: '📍' }

            return (
              <div key={row.id} className={`soft-card p-5 ${style.card}`}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-lg">{style.icon}</span>
                      <span className={style.badge}>
                        {row.performance === 'high'
                          ? '調子が良い'
                          : row.performance === 'low'
                          ? '少し弱め'
                          : 'ふつう'}
                      </span>
                    </div>

                    <h2 className="text-lg font-semibold text-main">{row.name}</h2>
                    <p className="text-xs text-sub mt-1">主な天候: {row.main_weather ?? '-'}</p>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-right">
                    <div className="rounded-2xl bg-white/70 border border-white p-3">
                      <p className="text-xs text-sub">出店回数</p>
                      <p className="font-bold text-main">{row.day_count} 日</p>
                    </div>
                    <div className="rounded-2xl bg-white/70 border border-white p-3">
                      <p className="text-xs text-sub">取引数</p>
                      <p className="font-bold text-main">{row.txn_count} 件</p>
                    </div>
                    <div className="rounded-2xl bg-white/70 border border-white p-3">
                      <p className="text-xs text-sub">平均取引単価</p>
                      <p className="font-bold text-blue-700">
                        {row.avg_sales_per_txn.toLocaleString()} 円
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/70 border border-white p-3">
                      <p className="text-xs text-sub">累計売上</p>
                      <p className="font-bold text-main">
                        {row.total_sales.toLocaleString()} 円
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white/70 border border-white p-3">
                      <p className="text-xs text-sub">推定粗利</p>
                      <p
                        className={`font-bold ${
                          row.gross_profit >= 0 ? 'text-green-700' : 'text-red-600'
                        }`}
                      >
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