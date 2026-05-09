import { NextRequest } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { normalizeAnalyticsDate } from '@/lib/analytics-date'
import { apiError, apiOk } from '@/lib/api-response'

export async function GET(req: NextRequest) {
  const auth = await requireRouteSession(req)
  if (auth.response) return auth.response
  const { supabase } = auth.session
  const { searchParams } = new URL(req.url)
  const start = normalizeAnalyticsDate(searchParams.get('start') ?? undefined)
  const end = normalizeAnalyticsDate(searchParams.get('end') ?? undefined)

  const { data: locations, error: locErr } = await (supabase as any)
    .from('locations')
    .select('id, name')

  if (locErr) {
    console.error('[analytics/locations] locations error:', locErr)
    return apiError(locErr.message)
  }

  const { data: txns, error: txErr } = await (supabase as any)
    .from('transactions')
    .select('location_id, total_amount, txn_date, is_return')
    .eq('is_return', false)
    .gte('txn_date', start ?? '1900-01-01')
    .lte('txn_date', end ?? '2999-12-31')

  if (txErr) {
    console.error('[analytics/locations] transactions error:', txErr)
    return apiError(txErr.message)
  }

  const { data: sales, error: salesErr } = await (supabase as any)
    .from('product_sales')
    .select('location_id, product_name, subtotal, quantity, txn_date')
    .gte('txn_date', start ?? '1900-01-01')
    .lte('txn_date', end ?? '2999-12-31')

  if (salesErr) {
    console.error('[analytics/locations] product_sales error:', salesErr)
    return apiError(salesErr.message)
  }

  const { data: stallLogs, error: stallLogsErr } = await (supabase as any)
    .from('stall_logs')
    .select('log_date, location_id')
    .gte('log_date', start ?? '1900-01-01')
    .lte('log_date', end ?? '2999-12-31')

  if (stallLogsErr) {
    console.error('[analytics/locations] stall_logs error:', stallLogsErr)
    return apiError(stallLogsErr.message)
  }

  const { data: costs, error: costsErr } = await (supabase as any)
    .from('product_master')
    .select('product_name, cost_amount, cost_rate')

  if (costsErr) {
    console.error('[analytics/locations] product_master error:', costsErr)
    return apiError(costsErr.message)
  }

  const { data: weather, error: weatherErr } = await (supabase as any)
    .from('weather_logs')
    .select('location_id, weather_type')
    .gte('log_date', start ?? '1900-01-01')
    .lte('log_date', end ?? '2999-12-31')

  if (weatherErr) {
    console.error('[analytics/locations] weather_logs error:', weatherErr)
    return apiError(weatherErr.message)
  }

  console.log('[analytics/locations] counts:', {
    locations: locations?.length ?? 0,
    txns: txns?.length ?? 0,
    sales: sales?.length ?? 0,
    stallLogs: stallLogs?.length ?? 0,
    costs: costs?.length ?? 0,
    weather: weather?.length ?? 0,
  })

  const costMap = new Map<string, number>()
  for (const c of (costs ?? []) as any[]) {
    if (c.cost_amount != null) {
      costMap.set(c.product_name, c.cost_amount)
    }
  }

  const stallLogByDate = new Map<string, string | null>()
  for (const row of (stallLogs ?? []) as any[]) {
    stallLogByDate.set(row.log_date, row.location_id ?? null)
  }

  const locMap = new Map<
    string,
    {
      name: string
      total_sales: number
      days: Set<string>
      total_cost: number
      weather_counts: Record<string, number>
    }
  >()

  for (const loc of (locations ?? []) as any[]) {
    locMap.set(loc.id, {
      name: loc.name,
      total_sales: 0,
      days: new Set(),
      total_cost: 0,
      weather_counts: {},
    })
  }

  for (const t of (txns ?? []) as any[]) {
    const locationId = t.location_id ?? stallLogByDate.get(t.txn_date) ?? null
    if (!locationId) continue
    if (!locMap.has(locationId)) {
      locMap.set(locationId, {
        name: '未設定の出店場所',
        total_sales: 0,
        days: new Set(),
        total_cost: 0,
        weather_counts: {},
      })
    }
    const entry = locMap.get(locationId)!

    entry.total_sales += t.total_amount ?? 0
    if (t.txn_date) {
      entry.days.add(t.txn_date)
    }
  }

  for (const s of (sales ?? []) as any[]) {
    const locationId = s.location_id ?? stallLogByDate.get(s.txn_date) ?? null
    if (!locationId) continue
    if (!locMap.has(locationId)) {
      locMap.set(locationId, {
        name: '未設定の出店場所',
        total_sales: 0,
        days: new Set(),
        total_cost: 0,
        weather_counts: {},
      })
    }
    const entry = locMap.get(locationId)!

    const unitCost = costMap.get(s.product_name)
    if (unitCost != null) {
      entry.total_cost += unitCost * (s.quantity ?? 1)
    }
  }

  for (const w of (weather ?? []) as any[]) {
    if (!w.location_id) continue
    const entry = locMap.get(w.location_id)
    if (!entry) continue

    entry.weather_counts[w.weather_type] =
      (entry.weather_counts[w.weather_type] ?? 0) + 1
  }

  const rows = Array.from(locMap.entries())
    .map(([id, e]) => {
      const count = e.days.size
      const avg = count > 0 ? Math.round(e.total_sales / count) : 0
      const profit = e.total_sales - e.total_cost
      const mainWeather =
        Object.entries(e.weather_counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '-'

      return {
        id,
        name: e.name,
        count,
        avg_sales: avg,
        total_sales: e.total_sales,
        profit,
        main_weather: mainWeather,
      }
    })
    .filter((r) => r.count > 0)
    .sort((a, b) => b.avg_sales - a.avg_sales)

  const total = rows.length
  const result = rows.map((r, i) => {
    let performance: 'high' | 'mid' | 'low'

    if (i < Math.ceil(total * 0.3)) performance = 'high'
    else if (i >= total - Math.ceil(total * 0.3)) performance = 'low'
    else performance = 'mid'

    return { ...r, performance }
  })

  console.log('[analytics/locations] result:', result)

  return apiOk(result)
}
