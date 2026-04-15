import { NextRequest, NextResponse } from 'next/server'
import { requireRouteSession } from '@/lib/auth'

const DAY_LABELS = ['月', '火', '水', '木', '金', '土', '日']

export async function GET(req: NextRequest) {
  const auth = await requireRouteSession(req)
  if (auth.response) return auth.response
  const { supabase } = auth.session

  const { data: txns, error } = await (supabase as any)
    .from('transactions')
    .select('hour_of_day, day_of_week, total_amount, txn_date')
    .eq('is_return', false)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const hourTotals = Array.from({ length: 24 }, () => ({ total: 0, count: 0 }))
  const heatmap: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0))

  for (const t of ((txns ?? []) as any[])) {
    const h = t.hour_of_day
    const dow = t.day_of_week
    hourTotals[h].total += t.total_amount
    hourTotals[h].count += 1
    heatmap[dow][h] += t.total_amount
  }

  const hourlyData = hourTotals
    .map((e, h) => ({
      hour: h,
      label: `${String(h).padStart(2, '0')}:00`,
      total_sales: e.total,
      txn_count: e.count,
    }))
    .filter(e => e.txn_count > 0)

  const heatmapData = DAY_LABELS.map((dayLabel, dow) => ({
    day: dow,
    label: dayLabel,
    hours: heatmap[dow].map((sales, h) => ({ hour: h, sales })),
  }))

  return NextResponse.json({ hourly: hourlyData, heatmap: heatmapData })
}
