'use client'

import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface DayData {
  day_of_week: number
  label:       string
  total_sales: number
  out_days:    number
  avg_sales:   number
}

const BAR_COLORS = ['#6B7FD7', '#6B7FD7', '#6B7FD7', '#6B7FD7', '#6B7FD7', '#F59E0B', '#EF4444']

export default function WeekdayAnalyticsPage() {
  const [data, setData]     = useState<DayData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/analytics/weekday')
      .then(r => r.json())
      .then(j => { setData(j.data ?? []); setLoading(false) })
  }, [])

  if (loading) return <p className="text-gray-400">読み込み中...</p>

  const maxAvg = Math.max(...data.map(d => d.avg_sales), 1)

  // グラフ用に色付き
  const chartData = data.map((d, i) => ({ ...d, fill: BAR_COLORS[i] ?? '#6B7FD7' }))

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">曜日別分析</h1>
      <p className="text-sm text-gray-500 mb-8">曜日ごとの平均売上をもとに、出店に適した曜日を把握できます。</p>

      {data.length === 0 ? (
        <p className="text-gray-400 text-center py-20">データがありません。</p>
      ) : (
        <>
          {/* 棒グラフ */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
            <h2 className="text-base font-semibold text-gray-700 mb-4">曜日別 平均売上</h2>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={chartData} margin={{ top: 4, right: 16, left: 16, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 13 }} />
                <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(v: number) => [`${v.toLocaleString()} 円`, '平均売上']}
                  labelFormatter={l => `${l}曜日`}
                />
                <Bar dataKey="avg_sales" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, i) => (
                    <rect key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* テーブル */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold text-gray-600">曜日</th>
                  <th className="text-right px-5 py-3 font-semibold text-gray-600">出店日数</th>
                  <th className="text-right px-5 py-3 font-semibold text-gray-600">平均売上</th>
                  <th className="text-right px-5 py-3 font-semibold text-gray-600">累計売上</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {data.map((d, i) => (
                  <tr key={d.day_of_week} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-5 py-3 font-medium text-gray-800">{d.label}曜日</td>
                    <td className="px-5 py-3 text-right text-gray-600">{d.out_days} 日</td>
                    <td className="px-5 py-3 text-right font-semibold text-blue-700">
                      {d.avg_sales.toLocaleString()} 円
                    </td>
                    <td className="px-5 py-3 text-right text-gray-600">
                      {d.total_sales.toLocaleString()} 円
                    </td>
                    <td className="px-5 py-3 w-32">
                      <div className="bg-gray-200 rounded-full h-2">
                        <div
                          className="h-2 rounded-full"
                          style={{
                            width: `${(d.avg_sales / maxAvg) * 100}%`,
                            background: BAR_COLORS[i] ?? '#6B7FD7',
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
