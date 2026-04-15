import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getHolidayFlagTone } from '@/lib/calendar'

export const dynamic = 'force-dynamic'

function fmtYen(value: number) {
  return `${value.toLocaleString('ja-JP')} 円`
}

function formatMonthLabel(value: string) {
  const date = new Date(`${value}T00:00:00+09:00`)
  return `${date.getFullYear()}年${date.getMonth() + 1}月`
}

function formatCreatedAt(value: string) {
  const date = new Date(value)
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(
    date.getMinutes()
  ).padStart(2, '0')}`
}

export default async function PlansPage({
  searchParams,
}: {
  searchParams?: { plan?: string }
}) {
  const { data: plans } = await (supabase as any)
    .from('operation_plans')
    .select('*')
    .order('created_at', { ascending: false })

  const { data: days } = await (supabase as any)
    .from('operation_plan_days')
    .select('*')
    .order('plan_date', { ascending: true })

  const { data: weatherForecasts } = await (supabase as any)
    .from('weather_forecasts')
    .select('*')

  const { data: salesForecasts } = await (supabase as any)
    .from('sales_forecasts')
    .select('*')

  const weatherMap = new Map<string, any>()
  for (const row of (weatherForecasts ?? []) as any[]) {
    weatherMap.set(row.plan_day_id, row)
  }

  const salesMap = new Map<string, any>()
  for (const row of (salesForecasts ?? []) as any[]) {
    salesMap.set(row.plan_day_id, row)
  }

  const dayMap = new Map<string, any[]>()
  for (const row of (days ?? []) as any[]) {
    const list = dayMap.get(row.plan_id) ?? []
    list.push(row)
    dayMap.set(row.plan_id, list)
  }

  const allPlans = (plans ?? []) as any[]
  const selectedPlanId =
    searchParams?.plan && allPlans.some((plan) => plan.id === searchParams.plan)
      ? searchParams.plan
      : allPlans[0]?.id
  const selectedPlan = allPlans.find((plan) => plan.id === selectedPlanId) ?? null
  const rows = selectedPlan ? (dayMap.get(selectedPlan.id) ?? []).sort((a, b) => a.plan_date.localeCompare(b.plan_date)) : []

  const selectedSales = rows
    .map((day) => salesMap.get(day.id))
    .filter(Boolean)

  const totalPredictedSales = selectedSales.reduce(
    (sum, sale) => sum + (sale?.predicted_sales ?? 0),
    0
  )
  const totalPredictedGrossProfit = selectedSales.reduce(
    (sum, sale) => sum + (sale?.predicted_gross_profit ?? 0),
    0
  )

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">営業予測（β）</h1>
          <p className="text-sm text-gray-500">
            取り込みごとにタブで切り替えながら、過去の予測内容を見返せます。
          </p>
        </div>

        <Link
          href="/plans/new"
          className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700"
        >
          新しい予測を作る
        </Link>
      </div>

      {allPlans.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-20 text-center">
          <p className="text-gray-600">まだ営業予測はありません。</p>
          <p className="text-sm text-gray-500 mt-2">カレンダー画像から予測案を作成できます。</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <p className="mb-3 text-sm font-medium text-gray-600">取り込み履歴</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {allPlans.map((plan) => {
                const active = plan.id === selectedPlanId
                const label = plan.title || `${formatMonthLabel(plan.plan_month)} の営業予測`
                const rowCount = (dayMap.get(plan.id) ?? []).length

                return (
                  <Link
                    key={plan.id}
                    href={`/plans?plan=${plan.id}`}
                    className={`min-w-[220px] rounded-xl border px-4 py-3 text-left transition ${
                      active
                        ? 'border-blue-500 bg-blue-50 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-blue-200 hover:bg-gray-50'
                    }`}
                  >
                    <p className={`text-sm font-semibold ${active ? 'text-blue-700' : 'text-gray-800'}`}>{label}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      取込: {formatCreatedAt(plan.created_at)} / {rowCount}日分
                    </p>
                  </Link>
                )
              })}
            </div>
          </div>

          {selectedPlan && (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <p className="text-xs text-gray-500 mb-1">選択中の予測</p>
                  <p className="text-lg font-semibold text-gray-800">
                    {selectedPlan.title || `${formatMonthLabel(selectedPlan.plan_month)} の営業予測`}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    画像: {selectedPlan.source_image_name || '-'}
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <p className="text-xs text-gray-500 mb-1">予測売上合計</p>
                  <p className="text-lg font-semibold text-gray-800">{fmtYen(totalPredictedSales)}</p>
                  <p className="mt-1 text-sm text-gray-500">{rows.length}日分を集計</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <p className="text-xs text-gray-500 mb-1">予測粗利合計</p>
                  <p className="text-lg font-semibold text-green-700">{fmtYen(totalPredictedGrossProfit)}</p>
                  <p className="mt-1 text-sm text-gray-500">状態: {selectedPlan.status}</p>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 bg-white p-6">
                <div className="mb-4">
                  <h2 className="text-xl font-semibold text-gray-800 mb-2">
                    {selectedPlan.title || `${formatMonthLabel(selectedPlan.plan_month)} の営業予測`}
                  </h2>
                  <p className="text-sm text-gray-500">
                    月: {selectedPlan.plan_month} / 画像: {selectedPlan.source_image_name || '-'} / 状態: {selectedPlan.status}
                  </p>
                </div>

                <div className="space-y-4">
                  {rows.map((day) => {
                    const weather = weatherMap.get(day.id)
                    const sales = salesMap.get(day.id)

                    return (
                      <div key={day.id} className="rounded-xl border border-gray-200 p-4">
                        <div className="mb-3 flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-gray-800">{day.plan_date}</p>
                              {day.holiday_flag && (
                                <span
                                  className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getHolidayFlagTone(
                                    day.holiday_flag
                                  )}`}
                                >
                                  {day.holiday_flag}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-500">
                              {day.operation_type === 'closed'
                                ? '休業'
                                : day.operation_type === 'event'
                                ? 'イベント営業'
                                : '通常営業'}
                            </p>
                          </div>
                          <div className="text-sm text-gray-500">
                            {day.business_start_time && day.business_end_time
                              ? `${day.business_start_time.slice(0, 5)} - ${day.business_end_time.slice(0, 5)}`
                              : '時間未設定'}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
                          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                            <p className="mb-1 text-xs text-gray-500">場所</p>
                            <p className="font-medium text-gray-800">{day.location_name || '-'}</p>
                            <p className="mt-1 text-xs text-gray-500">{day.municipality || '-'}</p>
                          </div>

                          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                            <p className="mb-1 text-xs text-gray-500">イベント</p>
                            <p className="font-medium text-gray-800">{day.event_name || 'なし'}</p>
                          </div>

                          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                            <p className="mb-1 text-xs text-gray-500">天気予報</p>
                            <p className="font-medium text-gray-800">{weather?.weather_type || '-'}</p>
                            <p className="mt-1 text-xs text-gray-500">
                              {weather?.temperature_max != null && weather?.temperature_min != null
                                ? `${weather.temperature_min} - ${weather.temperature_max} ℃`
                                : '未取得'}
                            </p>
                          </div>

                          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                            <p className="mb-1 text-xs text-gray-500">売上予測</p>
                            <p className="font-medium text-gray-800">
                              {sales ? fmtYen(sales.predicted_sales) : '-'}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                              {sales
                                ? `取引 ${sales.predicted_txn_count} 件 / 平均 ${fmtYen(sales.predicted_avg_ticket)}`
                                : '未計算'}
                            </p>
                            <p className="mt-1 text-xs text-green-700">
                              {sales ? `粗利 ${fmtYen(sales.predicted_gross_profit)}` : ''}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
