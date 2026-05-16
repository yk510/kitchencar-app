import { Suspense } from 'react'
import AnalyticsLoadingSkeleton from '@/components/AnalyticsLoadingSkeleton'
import AnalyticsPageHeader from '@/components/AnalyticsPageHeader'
import { AnalyticsScope } from '@/components/AnalyticsScopeTabs'
import { requireServerSession } from '@/lib/auth'
import { normalizeAnalyticsDate } from '@/lib/analytics-date'
import { getVendorWeekdayAnalytics } from '@/lib/vendor-weekday-analytics'
import { normalizeAnalyticsScope } from '@/lib/vendor-product-analytics'

export const dynamic = 'force-dynamic'

async function WeekdayAnalyticsContent({
  scope,
  start,
  end,
}: {
  scope: AnalyticsScope
  start?: string
  end?: string
}) {
  const { supabase, user } = await requireServerSession({ includeProfile: false })
  const data = await getVendorWeekdayAnalytics(supabase, user.id, scope, start, end)

  if (data.length === 0) {
    return (
      <div className="soft-panel text-center py-20">
        <p className="section-subtitle">この条件に一致するデータがありません。</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {data.map((row) => {
        const style =
          row.performance === 'high'
            ? { card: 'bg-green-50 border-green-200', badge: 'badge-soft badge-green', icon: '😊' }
            : row.performance === 'low'
            ? { card: 'bg-red-50 border-red-200', badge: 'badge-soft bg-red-100 text-red-800', icon: '🌀' }
            : { card: 'bg-white border-soft', badge: 'badge-soft bg-gray-100 text-gray-700', icon: '📅' }

        return (
          <div key={row.day} className={`soft-card p-5 ${style.card}`}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{style.icon}</span>
                  <span className={style.badge}>
                    {row.performance === 'high' ? '強い曜日' : row.performance === 'low' ? '弱い曜日' : '中間'}
                  </span>
                </div>
                <h2 className="text-lg font-semibold text-main">{row.label}曜日</h2>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-right">
                <div className="rounded-2xl bg-white/70 border border-white p-3">
                  <p className="text-xs text-sub">出店日数</p>
                  <p className="font-bold text-main">{row.day_count} 日</p>
                </div>
                <div className="rounded-2xl bg-white/70 border border-white p-3">
                  <p className="text-xs text-sub">取引数</p>
                  <p className="font-bold text-main">{row.txn_count} 件</p>
                </div>
                <div className="rounded-2xl bg-white/70 border border-white p-3">
                  <p className="text-xs text-sub">平均取引単価</p>
                  <p className="font-bold text-blue-700">{row.avg_sales_per_txn.toLocaleString()} 円</p>
                </div>
                <div className="rounded-2xl bg-white/70 border border-white p-3">
                  <p className="text-xs text-sub">累計売上</p>
                  <p className="font-bold text-main">{row.total_sales.toLocaleString()} 円</p>
                </div>
                <div className="rounded-2xl bg-white/70 border border-white p-3">
                  <p className="text-xs text-sub">推定粗利</p>
                  <p className={`font-bold ${row.gross_profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {row.gross_profit.toLocaleString()} 円
                  </p>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default async function WeekdayAnalyticsPage({
  searchParams,
}: {
  searchParams?: { scope?: string; start?: string; end?: string }
}) {
  const scope = normalizeAnalyticsScope(searchParams?.scope)
  const start = normalizeAnalyticsDate(searchParams?.start)
  const end = normalizeAnalyticsDate(searchParams?.end)

  const scopeLabel =
    scope === 'normal' ? '通常出店のみ' : scope === 'event' ? 'イベント出店のみ' : '全体'

  return (
    <div>
      <AnalyticsPageHeader
        title="曜日別分析"
        description="平均売上をもとに曜日ごとの傾向を表示します。"
        scopeLabel={scopeLabel}
        basePath="/analytics/weekday"
        currentScope={scope}
        currentStart={start}
        currentEnd={end}
      />
      <Suspense fallback={<AnalyticsLoadingSkeleton />}>
        <WeekdayAnalyticsContent scope={scope} start={start} end={end} />
      </Suspense>
    </div>
  )
}
