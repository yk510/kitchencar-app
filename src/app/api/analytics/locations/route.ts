import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  // 場所一覧
  const { data: locations, error: locErr } = await supabase
    .from('locations')
    .select('id, name')

  if (locErr) return NextResponse.json({ error: locErr.message }, { status: 500 })

  // 取引データ（場所ごとに集計）
  const { data: txns } = await supabase
    .from('transactions')
    .select('location_id, total_amount, txn_date')
    .eq('is_return', false)

  // 商品売上（原価計算用）
  const { data: sales } = await supabase
    .from('product_sales')
    .select('location_id, product_name, subtotal, quantity')

  // 原価マスタ
  const { data: costs } = await supabase
    .from('product_master')
    .select('product_name, cost_amount, cost_rate')

  // 天候ログ
  const { data: weather } = await supabase
    .from('weather_logs')
    .select('location_id, weather_type')

  // 原価マップ
  const costMap = new Map<string, number>()
  for (const c of ((costs ?? []) as any[])) {
    if (c.cost_amount != null) {
      costMap.set(c.product_name, c.cost_amount)
    } else if (c.cost_rate != null) {
      // 原価率の場合は後で単価から計算するためスキップ（ここでは0扱い）
    }
  }

  // 場所ごとに集計
  const locMap = new Map<string, {
    name: string
    total_sales: number
    days: Set<string>
    total_cost: number
    weather_counts: Record<string, number>
  }>()

  for (const loc of ((locations ?? []) as any[])) {
    locMap.set(loc.id, {
      name:           loc.name,
      total_sales:    0,
      days:           new Set(),
      total_cost:     0,
      weather_counts: {},
    })
  }

  for (const t of ((txns ?? []) as any[])) {
    if (!t.location_id) continue
    const entry = locMap.get(t.location_id)
    if (!entry) continue
    entry.total_sales += t.total_amount
    entry.days.add(t.txn_date)
  }

  for (const s of ((sales ?? []) as any[])) {
    if (!s.location_id) continue
    const entry = locMap.get(s.location_id)
    if (!entry) continue
    const unitCost = costMap.get(s.product_name)
    if (unitCost != null) {
      entry.total_cost += unitCost * (s.quantity ?? 1)
    }
  }

  for (const w of ((weather ?? []) as any[])) {
    if (!w.location_id) continue
    const entry = locMap.get(w.location_id)
    if (!entry) continue
    entry.weather_counts[w.weather_type] = (entry.weather_counts[w.weather_type] ?? 0) + 1
  }

  // パフォーマンス評価（平均売上の上位30% / 下位30%）
  const rows = Array.from(locMap.entries()).map(([id, e]) => {
    const count = e.days.size
    const avg   = count > 0 ? Math.round(e.total_sales / count) : 0
    const profit = e.total_sales - e.total_cost
    const mainWeather = Object.entries(e.weather_counts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? '-'
    return { id, name: e.name, count, avg_sales: avg, total_sales: e.total_sales, profit, main_weather: mainWeather }
  }).filter(r => r.count > 0).sort((a, b) => b.avg_sales - a.avg_sales)

  const total = rows.length
  const result = rows.map((r, i) => {
    let performance: 'high' | 'mid' | 'low'
    if (i < Math.ceil(total * 0.3))                     performance = 'high'
    else if (i >= total - Math.ceil(total * 0.3))       performance = 'low'
    else                                                 performance = 'mid'
    return { ...r, performance }
  })

  return NextResponse.json({ data: result })
}
