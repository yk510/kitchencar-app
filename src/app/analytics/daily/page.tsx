import { Suspense } from 'react'
import AnalyticsLoadingSkeleton from '@/components/AnalyticsLoadingSkeleton'
import DailySalesAnalyticsClient from '@/components/DailySalesAnalyticsClient'
import AnalyticsPageHeader from '@/components/AnalyticsPageHeader'
import { requireServerSession } from '@/lib/auth'
import {
  getMonthRange,
  getVendorDailyAnalytics,
  getVendorDailyMemos,
} from '@/lib/vendor-reflection'

export const dynamic = 'force-dynamic'

async function DailyAnalyticsContent({
  start,
  end,
}: {
  start: string
  end: string
}) {
  const { supabase, user } = await requireServerSession({ includeProfile: false })
  const [rows, memos] = await Promise.all([
    getVendorDailyAnalytics(supabase, user.id, start, end),
    getVendorDailyMemos(supabase, start, end),
  ])

  return (
    <DailySalesAnalyticsClient
      rows={rows}
      memos={memos}
    />
  )
}

export default async function DailyAnalyticsPage({
  searchParams,
}: {
  searchParams?: { start?: string; end?: string; month?: string }
}) {
  const range = getMonthRange(searchParams?.month)
  const start = searchParams?.start ?? range.start
  const end = searchParams?.end ?? range.end

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
      <Suspense fallback={<AnalyticsLoadingSkeleton variant="daily" />}>
        <DailyAnalyticsContent start={start} end={end} />
      </Suspense>
    </div>
  )
}
