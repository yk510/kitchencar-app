import { NextRequest } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import { normalizeAnalyticsDate } from '@/lib/analytics-date'
import { normalizeAnalyticsScope } from '@/lib/vendor-product-analytics'
import { getVendorWeekdayAnalytics } from '@/lib/vendor-weekday-analytics'

export async function GET(req: NextRequest) {
  const auth = await requireRouteSession(req)
  if (auth.response) return auth.response
  const { supabase, user } = auth.session
  const scope = normalizeAnalyticsScope(req.nextUrl.searchParams.get('scope') ?? undefined)
  const start = normalizeAnalyticsDate(req.nextUrl.searchParams.get('start') ?? undefined)
  const end = normalizeAnalyticsDate(req.nextUrl.searchParams.get('end') ?? undefined)

  try {
    const rows = await getVendorWeekdayAnalytics(supabase, user.id, scope, start, end)
    return apiOk(
      rows.map((row) => ({
        day_of_week: row.day,
        label: row.label,
        total_sales: row.total_sales,
        out_days: row.day_count,
        avg_sales: row.avg_sales,
        total_cost: row.total_cost,
        gross_profit: row.gross_profit,
        txn_count: row.txn_count,
        avg_sales_per_txn: row.avg_sales_per_txn,
        performance: row.performance,
      }))
    )
  } catch (error) {
    return apiError(error instanceof Error ? error.message : 'サーバーエラー')
  }
}
