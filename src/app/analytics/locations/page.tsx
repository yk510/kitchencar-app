import { supabase } from '@/lib/supabase'

async function getLocationAnalytics() {
  const res  = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL ? '' : 'http://localhost:3000'}/api/analytics/locations`, { cache: 'no-store' })
  return res.ok ? (await res.json()).data ?? [] : []
}

const PERF_STYLES = {
  high: { bg: 'bg-green-50 border-green-200',  badge: 'bg-green-100 text-green-800', label: '◎ 高' },
  mid:  { bg: 'bg-white border-gray-200',       badge: 'bg-gray-100  text-gray-700',  label: '△ 中' },
  low:  { bg: 'bg-red-50   border-red-200',     badge: 'bg-red-100   text-red-800',   label: '▼ 低' },
}

export default async function LocationAnalyticsPage() {
  const data = await getLocationAnalytics()

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">出店場所別分析</h1>
      <p className="text-sm text-gray-500 mb-6">
        平均売上をもとに上位30%を◎高、下位30%を▼低と評価します。
      </p>

      {data.length === 0 ? (
        <div className="text-center text-gray-400 py-20">
          <p>データがありません。出店ログとCSVを登録してください。</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.map((row: any) => {
            const style = PERF_STYLES[row.performance as keyof typeof PERF_STYLES]
            return (
              <div key={row.id} className={`rounded-xl border p-5 ${style.bg}`}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${style.badge}`}>
                        {style.label}
                      </span>
                      <h2 className="font-semibold text-gray-800">{row.name}</h2>
                    </div>
                    <p className="text-xs text-gray-400">主な天候: {row.main_weather}</p>
                  </div>
                  <div className="flex gap-6 text-right flex-wrap">
                    <div>
                      <p className="text-xs text-gray-400">出店回数</p>
                      <p className="font-bold text-gray-700">{row.count} 日</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">平均売上</p>
                      <p className="font-bold text-blue-700">{row.avg_sales.toLocaleString()} 円</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">累計売上</p>
                      <p className="font-bold text-gray-700">{row.total_sales.toLocaleString()} 円</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">推定利益</p>
                      <p className={`font-bold ${row.profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                        {row.profit.toLocaleString()} 円
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
