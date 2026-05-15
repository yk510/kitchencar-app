import DailySalesAnalyticsClient from '@/components/DailySalesAnalyticsClient'
import AnalyticsPageHeader from '@/components/AnalyticsPageHeader'
import { requireServerSession } from '@/lib/auth'
import {
  getMonthRange,
  getVendorDailyAnalytics,
  getVendorDailyMemos,
} from '@/lib/vendor-reflection'

export const dynamic = 'force-dynamic'

export default async function DailyAnalyticsPage({
  searchParams,
}: {
  searchParams?: { start?: string; end?: string; month?: string }
}) {
  const { supabase, user } = await requireServerSession({ includeProfile: false })
  const range = getMonthRange(searchParams?.month)
  const start = searchParams?.start ?? range.start
  const end = searchParams?.end ?? range.end
  const [rows, memos] = await Promise.all([
    getVendorDailyAnalytics(supabase, user.id, start, end),
    getVendorDailyMemos(supabase, start, end),
  ])

  return (
    <div>
      <AnalyticsPageHeader
        title="日別売上"
        description="その月の売上を日ごとに確認しながら、営業メモを残せます。週ごとの振り返りは週報ページで確認できます。"
        basePath="/analytics/daily"
        currentStart={start}
        currentEnd={end}
        showScopeTabs={false}
      />
      <DailySalesAnalyticsClient
        rows={rows}
        memos={memos}
      />
    </div>
  )
}
