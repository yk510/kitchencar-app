import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const { data: locations, error: locErr } = await supabase
    .from('locations')
    .select('id, name')

  if (locErr) {
    console.error('[analytics/locations] locations error:', locErr)
    return NextResponse.json({ error: locErr.message }, { status: 500 })
  }

  const { data: txns, error: txErr } = await supabase
    .from('transactions')
    .select('location_id, total_amount, txn_date, is_return')
    .eq('is_return', false)

  if (txErr) {
    console.error('[analytics/locations] transactions error:', txErr)
    return NextResponse.json({ error: txErr.message }, { status: 500 })
  }

  const { data: sales, error: salesErr } = await supabase
    .from('product_sales')
    .select('location_id, product_name, subtotal, quantity')

  if (salesErr) {
    console.error('[analytics/locations] product_sales error:', salesErr)
    return NextResponse.json({ error: salesErr.message }, { status: 500 })
  }

  const { data: costs, error: costsErr } = await supabase
    .from('product_master')
    .select('product_name, cost_amount, cost_rate')

  if (costsErr) {
    console.error('[analytics/locations] product_master error:', costsErr)
    return NextResponse.json({ error: costsErr.message }, { status: 500 })
  }

  const { data: weather, error: weatherErr } = await supabase
    .from('weather_logs')
    .select('location_id, weather_type')

  if (weatherErr) {
    console.error('[analytics/locations] weather_logs error:', weatherErr)
    return NextResponse.json({ error: weatherErr.message }, { status: 500 })
  }

  console.log('[analytics/locations] counts:', {
    locations: locations?.length ?? 0,
    txns: txns?.length ?? 0,
    sales: sales?.length ?? 0,
    costs: costs?.length ?? 0,
    weather: weather?.length ?? 0,
  })

  const costMap = new Map<string, number>()
  for (const c of (costs ?? []) as any[]) {
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
    if (!t.location_id) continue
    const entry = locMap.get(t.location_id)
    if (!entry) continue

    entry.total_sales += t.total_amount ?? 0
    if (t.txn_date) {
      entry.days.add(t.txn_date)
    }
  }

  for (const s of (sales ?? []) as any[]) {
    if (!s.location_id) continue
    const entry = locMap.get(s.location_id)
    if (!entry) continue

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

  return NextResponse.json({ data: result })
}