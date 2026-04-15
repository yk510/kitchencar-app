import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { getHolidayFlagTone } from '@/lib/calendar'

export const dynamic = 'force-dynamic'

function fmtYen(value: number) {
  return `${value.toLocaleString('ja-JP')} 円`
}

export default async function PlansPage() {
  const { data: plans } = await (supabase as any)
    .from('operation_plans')
    .select('*')
    .order('plan_month', { ascending: false })

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

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">営業予定と予測</h1>
          <p className="text-sm text-gray-500">
            保存した営業予定、天気予報、売上予測を確認できます。
          </p>
        </div>

        <Link
          href="/plans/new"
          className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700"
        >
          新しい予定を作る
        </Link>
      </div>

      {(plans ?? []).length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-20 text-center">
          <p className="text-gray-600">まだ営業予定はありません。</p>
          <p className="text-sm text-gray-500 mt-2">カレンダー画像から予定案を作成できます。</p>
        </div>
      ) : (
        <div className="space-y-6">
          {(plans ?? []).map((plan: any) => {
            const rows = (dayMap.get(plan.id) ?? []).sort((a, b) =>
              a.plan_date.localeCompare(b.plan_date)
            )

            return (
              <div key={plan.id} className="rounded-xl border border-gray-200 bg-white p-6">
                <div className="mb-4">
                  <h2 className="text-xl font-semibold text-gray-800 mb-2">
                    {plan.title || `${plan.plan_month} の営業予定`}
                  </h2>
                  <p className="text-sm text-gray-500">
                    月: {plan.plan_month} / 画像: {plan.source_image_name || '-'} / 状態: {plan.status}
                  </p>
                </div>

                <div className="space-y-4">
                  {rows.map((day) => {
                    const weather = weatherMap.get(day.id)
                    const sales = salesMap.get(day.id)

                    return (
                      <div key={day.id} className="rounded-xl border border-gray-200 p-4">
                        <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
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

                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 text-sm">
                          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                            <p className="text-xs text-gray-500 mb-1">場所</p>
                            <p className="font-medium text-gray-800">{day.location_name || '-'}</p>
                            <p className="text-xs text-gray-500 mt-1">{day.municipality || '-'}</p>
                          </div>

                          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                            <p className="text-xs text-gray-500 mb-1">イベント</p>
                            <p className="font-medium text-gray-800">{day.event_name || 'なし'}</p>
                          </div>

                          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                            <p className="text-xs text-gray-500 mb-1">天気予報</p>
                            <p className="font-medium text-gray-800">{weather?.weather_type || '-'}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {weather?.temperature_max != null && weather?.temperature_min != null
                                ? `${weather.temperature_min} - ${weather.temperature_max} ℃`
                                : '未取得'}
                            </p>
                          </div>

                          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                            <p className="text-xs text-gray-500 mb-1">売上予測</p>
                            <p className="font-medium text-gray-800">
                              {sales ? fmtYen(sales.predicted_sales) : '-'}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {sales
                                ? `取引 ${sales.predicted_txn_count} 件 / 平均 ${fmtYen(sales.predicted_avg_ticket)}`
                                : '未計算'}
                            </p>
                            <p className="text-xs text-green-700 mt-1">
                              {sales ? `粗利 ${fmtYen(sales.predicted_gross_profit)}` : ''}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
