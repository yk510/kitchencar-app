import { Suspense } from 'react'
import AnalyticsLoadingSkeleton from '@/components/AnalyticsLoadingSkeleton'
import AnalyticsPageHeader from '@/components/AnalyticsPageHeader'
import { AnalyticsScope } from '@/components/AnalyticsScopeTabs'
import { requireServerSession } from '@/lib/auth'
import { normalizeAnalyticsDate } from '@/lib/analytics-date'
import { getVendorProductAnalytics, normalizeAnalyticsScope } from '@/lib/vendor-product-analytics'

export const dynamic = 'force-dynamic'

async function ProductAnalyticsContent({
  scope,
  start,
  end,
}: {
  scope: AnalyticsScope
  start?: string
  end?: string
}) {
  const { supabase, user } = await requireServerSession({ includeProfile: false })
  const data = await getVendorProductAnalytics(supabase, user.id, scope, start, end)

  if (data.length === 0) {
    return (
      <div className="soft-panel text-center py-20">
        <p className="section-subtitle">この条件に一致するデータがありません。</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {data.map((row, i) => {
        const profit = row.profit ?? 0
        return (
        <div
          key={row.product_name}
          className="soft-card p-5 bg-white"
        >
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-orange-50 border border-orange-200 text-sm font-bold text-orange-700">
                  {i + 1}
                </span>
                <span className="text-lg">🥤</span>
              </div>
              <h2 className="text-lg font-semibold text-main">{row.product_name}</h2>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-right">
              <div className="rounded-2xl bg-[#fffdf9] border border-soft p-3">
                <p className="text-xs text-sub">販売数量</p>
                <p className="font-bold text-main">{row.total_qty} 個</p>
              </div>
              <div className="rounded-2xl bg-[#fffdf9] border border-soft p-3">
                <p className="text-xs text-sub">取引件数</p>
                <p className="font-bold text-main">{row.txn_count} 件</p>
              </div>
              <div className="rounded-2xl bg-[#fffdf9] border border-soft p-3">
                <p className="text-xs text-sub">累計売上</p>
                <p className="font-bold text-blue-700">
                  {row.total_sales.toLocaleString()} 円
                </p>
              </div>
              <div className="rounded-2xl bg-[#fffdf9] border border-soft p-3">
                <p className="text-xs text-sub">平均売上 / 取引</p>
                <p className="font-bold text-main">
                  {row.avg_sales_per_txn.toLocaleString()} 円
                </p>
              </div>
              <div className="rounded-2xl bg-[#fffdf9] border border-soft p-3">
                <p className="text-xs text-sub">推定利益</p>
                <p
                  className={`font-bold ${
                    profit >= 0 ? 'text-green-700' : 'text-red-600'
                  }`}
                >
                  {row.profit != null ? `${profit.toLocaleString()} 円` : '-'}
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

export default async function ProductAnalyticsPage({
  searchParams,
}: {
  searchParams?: { scope?: string; start?: string; end?: string }
}) {
  const scope = normalizeAnalyticsScope(searchParams?.scope)
  const start = normalizeAnalyticsDate(searchParams?.start)
  const end = normalizeAnalyticsDate(searchParams?.end)

  const scopeLabel =
    scope === 'normal'
      ? '通常出店のみ'
      : scope === 'event'
      ? 'イベント出店のみ'
      : '全体'

  return (
    <div>
      <AnalyticsPageHeader
        title="商品別分析"
        description="商品ごとの売上・販売数量・利益感を表示します。"
        scopeLabel={scopeLabel}
        basePath="/analytics/products"
        currentScope={scope}
        currentStart={start}
        currentEnd={end}
      />
      <Suspense fallback={<AnalyticsLoadingSkeleton />}>
        <ProductAnalyticsContent scope={scope} start={start} end={end} />
      </Suspense>
    </div>
  )
}
