import { NextRequest } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import { generateVendorWeeklyReport } from '@/lib/openai'
import { getVendorDailyAnalytics, getVendorDailyMemos, getVendorWeeklyReports } from '@/lib/vendor-reflection'
import type {
  VendorWeeklyReportGeneratePayload,
  VendorWeeklyReportListPayload,
} from '@/types/api-payloads'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRouteSession(req)
    if (auth.response) return auth.response
    const { session } = auth

    if (session.role !== 'vendor') {
      return apiError('ベンダーのみ利用できます', 403)
    }

    const { searchParams } = new URL(req.url)
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    if (!start || !end) {
      return apiError('期間が不正です', 400)
    }

    const payload: VendorWeeklyReportListPayload = await getVendorWeeklyReports(session.supabase, start, end)
    return apiOk(payload)
  } catch (error) {
    console.error('[vendor/weekly-reports GET]', error)
    return apiError('週報の取得に失敗しました')
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRouteSession(req)
    if (auth.response) return auth.response
    const { session } = auth

    if (session.role !== 'vendor') {
      return apiError('ベンダーのみ利用できます', 403)
    }

    const body = await req.json()
    const weekStart = String(body.week_start_date ?? '').trim()
    const weekEnd = String(body.week_end_date ?? '').trim()

    if (!weekStart || !weekEnd) {
      return apiError('週の期間が不正です', 400)
    }

    const [rows, memos] = await Promise.all([
      getVendorDailyAnalytics(session.supabase, weekStart, weekEnd),
      getVendorDailyMemos(session.supabase, weekStart, weekEnd),
    ])

    const memoMap = new Map(memos.map((item) => [item.memo_date, item.memo_text]))
    const promptRows = rows.map((row) => ({
      date: row.date,
      sales: row.sales,
      txnCount: row.txnCount,
      avgTicket: row.avgTicket,
      grossProfit: row.grossProfit,
      locationName: row.locationName,
      eventName: row.eventName,
      weatherType: row.weatherType,
      memoText: memoMap.get(row.date) ?? '',
    }))

    if (promptRows.length === 0) {
      return apiError('この週の売上データがまだありません', 400)
    }

    const draft = await generateVendorWeeklyReport({
      weekStart,
      weekEnd,
      rows: promptRows,
    })

    const sourceSales = promptRows.reduce((sum, row) => sum + row.sales, 0)
    const sourceNoteCount = promptRows.filter((row) => row.memoText.trim()).length

    const { data, error } = await (session.supabase as any)
      .from('vendor_weekly_reports')
      .upsert(
        [
          {
            user_id: session.user.id,
            week_start_date: weekStart,
            week_end_date: weekEnd,
            report_title: draft.report_title,
            weekly_summary: draft.weekly_summary,
            ai_feedback: draft.ai_feedback,
            source_note_count: sourceNoteCount,
            source_sales: sourceSales,
            helpful_feedback: null,
            helpful_marked_at: null,
          },
        ],
        { onConflict: 'user_id,week_start_date,week_end_date' }
      )
      .select('*')
      .single()

    if (error) {
      return apiError(error.message)
    }

    const payload: VendorWeeklyReportGeneratePayload = data
    return apiOk(payload)
  } catch (error: any) {
    console.error('[vendor/weekly-reports POST]', error)
    return apiError(error.message ?? 'AI週報の作成に失敗しました')
  }
}
