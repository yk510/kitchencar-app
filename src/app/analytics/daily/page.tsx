import { supabase } from '@/lib/supabase'
import AnalyticsPageHeader from '@/components/AnalyticsPageHeader'
import { getDefaultHolidayFlag, getHolidayFlagTone, getWeekdayLabel, getWeekdayIndex } from '@/lib/calendar'

export const dynamic = 'force-dynamic'

function fmtYen(value: number) {
  return `${value.toLocaleString('ja-JP')} 円`
}

function formatAverageTemperature(min: number | null, max: number | null) {
  if (min == null || max == null) return '-'
  return `${((min + max) / 2).toFixed(1)}℃`
}

function getMonthRange(baseDate?: string) {
  if (baseDate) {
    const date = new Date(`${baseDate}T00:00:00+09:00`)
    const start = new Date(date.getFullYear(), date.getMonth(), 1)
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0)
    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    }
  }

  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  }
}

async function getDailyAnalytics(start: string, end: string) {
  const [{ data: txns, error: txnError }, { data: sales, error: salesError }, { data: costs, error: costError }, { data: weatherLogs, error: weatherError }, { data: locations, error: locationError }, { data: stallLogs, error: stallLogError }] =
    await Promise.all([
      (supabase as any)
        .from('transactions')
        .select('txn_no, txn_date, total_amount, location_id')
        .eq('is_return', false)
        .gte('txn_date', start)
        .lte('txn_date', end)
        .order('txn_date', { ascending: true }),
      (supabase as any)
        .from('product_sales')
        .select('txn_no, txn_date, product_name, quantity')
        .gte('txn_date', start)
        .lte('txn_date', end),
      (supabase as any)
        .from('product_master')
        .select('product_name, cost_amount'),
      (supabase as any)
        .from('weather_logs')
        .select('log_date, location_id, weather_type, temperature_min, temperature_max')
        .gte('log_date', start)
        .lte('log_date', end),
      (supabase as any)
        .from('locations')
        .select('id, name, address'),
      (supabase as any)
        .from('stall_logs')
        .select('log_date, location_id')
        .gte('log_date', start)
        .lte('log_date', end),
    ])

  if (txnError) throw new Error(txnError.message)
  if (salesError) throw new Error(salesError.message)
  if (costError) throw new Error(costError.message)
  if (weatherError) throw new Error(weatherError.message)
  if (locationError) throw new Error(locationError.message)
  if (stallLogError) throw new Error(stallLogError.message)

  const locationMap = new Map<string, { name: string; address: string }>()
  for (const location of (locations ?? []) as any[]) {
    locationMap.set(location.id, {
      name: location.name,
      address: location.address,
    })
  }

  const costMap = new Map<string, number>()
  for (const item of (costs ?? []) as any[]) {
    if (item.cost_amount != null) {
      costMap.set(item.product_name, item.cost_amount)
    }
  }

  const grossProfitByTxnNo = new Map<string, number>()
  for (const row of (sales ?? []) as any[]) {
    const unitCost = costMap.get(row.product_name) ?? 0
    grossProfitByTxnNo.set(
      row.txn_no,
      (grossProfitByTxnNo.get(row.txn_no) ?? 0) + unitCost * (row.quantity ?? 0)
    )
  }

  const stallLogLocationByDate = new Map<string, string>()
  for (const row of (stallLogs ?? []) as any[]) {
    if (row.location_id) {
      stallLogLocationByDate.set(row.log_date, row.location_id)
    }
  }

  const weatherMap = new Map<string, { weather_type: string | null; temperature_min: number | null; temperature_max: number | null }>()
  for (const row of (weatherLogs ?? []) as any[]) {
    weatherMap.set(`${row.log_date}__${row.location_id ?? 'none'}`, {
      weather_type: row.weather_type,
      temperature_min: row.temperature_min,
      temperature_max: row.temperature_max,
    })
  }

  const rows = new Map<
    string,
    {
      date: string
      sales: number
      txnCount: number
      grossProfit: number
      locationId: string | null
    }
  >()

  for (const txn of (txns ?? []) as any[]) {
    const date = txn.txn_date
    const current = rows.get(date) ?? {
      date,
      sales: 0,
      txnCount: 0,
      grossProfit: 0,
      locationId: stallLogLocationByDate.get(date) ?? txn.location_id ?? null,
    }

    current.sales += txn.total_amount ?? 0
    current.txnCount += 1
    current.grossProfit += (txn.total_amount ?? 0) - (grossProfitByTxnNo.get(txn.txn_no) ?? 0)

    if (!current.locationId) {
      current.locationId = txn.location_id ?? stallLogLocationByDate.get(date) ?? null
    }

    rows.set(date, current)
  }

  return Array.from(rows.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((row) => {
      const locationId = row.locationId
      const location = locationId ? locationMap.get(locationId) : null
      const weather =
        weatherMap.get(`${row.date}__${locationId ?? 'none'}`) ??
        weatherMap.get(`${row.date}__none`) ??
        null

      return {
        date: row.date,
        weekday: getWeekdayLabel(row.date),
        holidayFlag: getDefaultHolidayFlag(row.date),
        locationName: location?.name ?? '-',
        municipality: location?.address ?? '-',
        weatherType: weather?.weather_type ?? '-',
        avgTemperature: formatAverageTemperature(
          weather?.temperature_min ?? null,
          weather?.temperature_max ?? null
        ),
        sales: row.sales,
        txnCount: row.txnCount,
        avgTicket: row.txnCount > 0 ? Math.round(row.sales / row.txnCount) : 0,
        grossProfit: row.grossProfit,
      }
    })
}

export default async function DailyAnalyticsPage({
  searchParams,
}: {
  searchParams?: { start?: string; end?: string; month?: string }
}) {
  const range = getMonthRange(searchParams?.month)
  const start = searchParams?.start ?? range.start
  const end = searchParams?.end ?? range.end
  const rows = await getDailyAnalytics(start, end)

  return (
    <div>
      <AnalyticsPageHeader
        title="日別売上"
        description="その月の売上を日ごとに一覧で確認できます。"
        basePath="/analytics/daily"
        currentStart={start}
        currentEnd={end}
        showScopeTabs={false}
      />

      {rows.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-20 text-center">
          <p className="text-gray-600">この期間の売上データはありません。</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-[1180px] w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="border-b border-gray-200 bg-gray-50 px-4 py-3 font-medium">日付</th>
                <th className="border-b border-gray-200 bg-gray-50 px-4 py-3 font-medium">曜日</th>
                <th className="border-b border-gray-200 bg-gray-50 px-4 py-3 font-medium">休祝日</th>
                <th className="border-b border-gray-200 bg-gray-50 px-4 py-3 font-medium">出店場所</th>
                <th className="border-b border-gray-200 bg-gray-50 px-4 py-3 font-medium">市町村</th>
                <th className="border-b border-gray-200 bg-gray-50 px-4 py-3 font-medium">天候</th>
                <th className="border-b border-gray-200 bg-gray-50 px-4 py-3 font-medium">平均気温</th>
                <th className="border-b border-gray-200 bg-gray-50 px-4 py-3 font-medium">当日の売上</th>
                <th className="border-b border-gray-200 bg-gray-50 px-4 py-3 font-medium">取引数</th>
                <th className="border-b border-gray-200 bg-gray-50 px-4 py-3 font-medium">平均取引単価</th>
                <th className="border-b border-gray-200 bg-gray-50 px-4 py-3 font-medium">当日の推定粗利</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const weekdayIndex = getWeekdayIndex(row.date)
                const rowTone =
                  weekdayIndex === 0
                    ? 'bg-rose-50'
                    : weekdayIndex === 6
                    ? 'bg-sky-50'
                    : 'bg-white'

                return (
                  <tr key={row.date} className={rowTone}>
                    <td className="border-b border-gray-100 px-4 py-3 font-medium text-gray-800">{row.date}</td>
                    <td className="border-b border-gray-100 px-4 py-3">{row.weekday}</td>
                    <td className="border-b border-gray-100 px-4 py-3">
                      {row.holidayFlag ? (
                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getHolidayFlagTone(row.holidayFlag)}`}>
                          {row.holidayFlag}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="border-b border-gray-100 px-4 py-3">{row.locationName}</td>
                    <td className="border-b border-gray-100 px-4 py-3">{row.municipality}</td>
                    <td className="border-b border-gray-100 px-4 py-3">{row.weatherType}</td>
                    <td className="border-b border-gray-100 px-4 py-3">{row.avgTemperature}</td>
                    <td className="border-b border-gray-100 px-4 py-3 font-medium text-gray-800">{fmtYen(row.sales)}</td>
                    <td className="border-b border-gray-100 px-4 py-3">{row.txnCount.toLocaleString('ja-JP')}</td>
                    <td className="border-b border-gray-100 px-4 py-3">{fmtYen(row.avgTicket)}</td>
                    <td className="border-b border-gray-100 px-4 py-3 text-green-700">{fmtYen(row.grossProfit)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
