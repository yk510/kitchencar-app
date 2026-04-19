import AnalyticsPageHeader from '@/components/AnalyticsPageHeader'
import WeeklyReportsClient from '@/components/WeeklyReportsClient'
import { requireServerSession } from '@/lib/auth'
import {
  getMonthRange,
  getVendorDailyAnalytics,
  getVendorDailyMemos,
  getVendorWeeklyReports,
  getWeekRanges,
} from '@/lib/vendor-reflection'

export const dynamic = 'force-dynamic'

export default async function WeeklyReportsPage({
  searchParams,
}: {
  searchParams?: { start?: string; end?: string; month?: string }
}) {
  const { supabase } = await requireServerSession()
  const range = getMonthRange(searchParams?.month)
  const start = searchParams?.start ?? range.start
  const end = searchParams?.end ?? range.end

  const [rows, memos, weeklyReports] = await Promise.all([
    getVendorDailyAnalytics(supabase, start, end),
    getVendorDailyMemos(supabase, start, end),
    getVendorWeeklyReports(supabase, start, end),
  ])
  const weeks = getWeekRanges(start, end)

  return (
    <div>
      <AnalyticsPageHeader
        title="週報"
        description="営業メモと売上成績をもとに、週ごとの振り返りとAIフィードバックを確認できます。"
        basePath="/reports/weekly"
        currentStart={start}
        currentEnd={end}
        showScopeTabs={false}
      />

      <WeeklyReportsClient rows={rows} memos={memos} weeklyReports={weeklyReports} weeks={weeks} />
    </div>
  )
}
