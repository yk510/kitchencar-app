import { NextRequest } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import { normalizeAnalyticsDate } from '@/lib/analytics-date'
import {
  buildStallLogResolutionMap,
  matchesAnalyticsScope,
  resolveAnalyticsEventId,
} from '@/lib/analytics-resolution'

const DAY_LABELS = ['月', '火', '水', '木', '金', '土', '日']

function normalizeScope(scope?: string): 'all' | 'normal' | 'event' {
  if (scope === 'normal') return 'normal'
  if (scope === 'event') return 'event'
  return 'all'
}

export async function GET(req: NextRequest) {
  const auth = await requireRouteSession(req)
  if (auth.response) return auth.response
  const { supabase } = auth.session
  const scope = normalizeScope(req.nextUrl.searchParams.get('scope') ?? undefined)
  const start = normalizeAnalyticsDate(req.nextUrl.searchParams.get('start') ?? undefined)
  const end = normalizeAnalyticsDate(req.nextUrl.searchParams.get('end') ?? undefined)

  let txnsQuery = (supabase as any)
    .from('transactions')
    .select('hour_of_day, day_of_week, total_amount, txn_date, event_id')
    .eq('is_return', false)

  if (start) txnsQuery = txnsQuery.gte('txn_date', start)
  if (end) txnsQuery = txnsQuery.lte('txn_date', end)

  const { data: txns, error } = await txnsQuery
  if (error) return apiError(error.message)

  let stallLogsQuery = (supabase as any)
    .from('stall_logs')
    .select('log_date, event_id')

  if (start) stallLogsQuery = stallLogsQuery.gte('log_date', start)
  if (end) stallLogsQuery = stallLogsQuery.lte('log_date', end)

  const { data: stallLogs, error: stallLogsErr } = await stallLogsQuery
  if (stallLogsErr) return apiError(stallLogsErr.message)

  const stallLogByDate = buildStallLogResolutionMap((stallLogs ?? []) as any[])

  const hourTotals = Array.from({ length: 24 }, () => ({ total: 0, count: 0 }))
  const heatmap: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0))

  for (const t of ((txns ?? []) as any[])) {
    const resolvedEventId = resolveAnalyticsEventId(t.txn_date, t.event_id, stallLogByDate)
    if (!matchesAnalyticsScope(scope, resolvedEventId)) continue

    const h = t.hour_of_day
    const dow = t.day_of_week
    if (h == null || dow == null) continue
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

  return apiOk({ hourly: hourlyData, heatmap: heatmapData })
}
