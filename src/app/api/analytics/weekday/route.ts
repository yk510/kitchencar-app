import { NextRequest } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import { normalizeAnalyticsDate } from '@/lib/analytics-date'
import {
  buildStallLogResolutionMap,
  matchesAnalyticsScope,
  resolveAnalyticsEventId,
} from '@/lib/analytics-resolution'
import { fetchMobileOrderAnalyticsData } from '@/lib/mobile-order-analytics'

// 0=月 〜 6=日
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
    .select('day_of_week, txn_date, total_amount, event_id')
    .eq('is_return', false)

  if (start) txnsQuery = txnsQuery.gte('txn_date', start)
  if (end) txnsQuery = txnsQuery.lte('txn_date', end)

  const { data: txns, error } = await txnsQuery
  if (error) return apiError(error.message)

  let salesQuery = (supabase as any)
    .from('product_sales')
    .select('txn_no, product_name, subtotal, quantity, txn_date, event_id')

  if (start) salesQuery = salesQuery.gte('txn_date', start)
  if (end) salesQuery = salesQuery.lte('txn_date', end)

  const { data: sales } = await salesQuery

  let stallLogsQuery = (supabase as any)
    .from('stall_logs')
    .select('log_date, event_id')

  if (start) stallLogsQuery = stallLogsQuery.gte('log_date', start)
  if (end) stallLogsQuery = stallLogsQuery.lte('log_date', end)

  const { data: stallLogs, error: stallLogsErr } = await stallLogsQuery
  if (stallLogsErr) return apiError(stallLogsErr.message)

  const stallLogByDate = buildStallLogResolutionMap((stallLogs ?? []) as any[])
  const mobileOrderAnalytics = await fetchMobileOrderAnalyticsData(supabase, {
    scope,
    start,
    end,
    stallLogByDate,
  })

  const txnDayMap = new Map<string, number>()
  const dayTotals = Array.from({ length: 7 }, () => ({ total: 0, days: new Set<string>() }))

  for (const t of ((txns ?? []) as any[])) {
    const resolvedEventId = resolveAnalyticsEventId(t.txn_date, t.event_id, stallLogByDate)
    if (!matchesAnalyticsScope(scope, resolvedEventId)) continue
    txnDayMap.set(t.txn_date + '_', t.day_of_week)
    const dow = t.day_of_week
    if (dow == null) continue
    dayTotals[dow].total += t.total_amount
    dayTotals[dow].days.add(t.txn_date)
  }

  const dayProductMap: Map<number, Map<string, number>>[] = Array.from({ length: 7 }, () => new Map())

  for (const t of ((txns ?? []) as any[])) {
    const resolvedEventId = resolveAnalyticsEventId(t.txn_date, t.event_id, stallLogByDate)
    if (!matchesAnalyticsScope(scope, resolvedEventId)) continue
    const dowEntry = dayProductMap[t.day_of_week]
    // 未使用ロジック
  }

  for (const s of ((sales ?? []) as any[])) {
    const resolvedEventId = resolveAnalyticsEventId(s.txn_date, s.event_id, stallLogByDate)
    if (!matchesAnalyticsScope(scope, resolvedEventId)) continue
  }

  for (const order of mobileOrderAnalytics.orders) {
    const dow = order.dayOfWeek
    const entry = dayTotals[dow]
    if (!entry) continue
    entry.total += order.totalAmount
    entry.days.add(order.businessDate)
  }

  const result = DAY_LABELS.map((label, dow) => {
    const entry = dayTotals[dow]
    const outDays = entry.days.size
    return {
      day_of_week: dow,
      label,
      total_sales: entry.total,
      out_days: outDays,
      avg_sales: outDays > 0 ? Math.round(entry.total / outDays) : 0,
    }
  })

  return apiOk(result)
}
