'use client'

import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const DAY_LABELS = ['月', '火', '水', '木', '金', '土', '日']

function heatColor(val: number, max: number): string {
  if (max === 0 || val === 0) return '#F3F4F6'
  const ratio = val / max
  if (ratio < 0.25) return '#DBEAFE'
  if (ratio < 0.5)  return '#93C5FD'
  if (ratio < 0.75) return '#3B82F6'
  return '#1D4ED8'
}

export default function HourlyAnalyticsPage() {
  const [hourly,  setHourly]  = useState<any[]>([])
  const [heatmap, setHeatmap] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/analytics/hourly')
      .then(r => r.json())
      .then(j => {
        setHourly(j.hourly ?? [])
        setHeatmap(j.heatmap ?? [])
        setLoading(false)
      })
  }, [])

  if (loading) return <p className="text-gray-400">読み込み中...</p>

  // ヒートマップの最大値
  const maxHeat = Math.max(...heatmap.flatMap((d: any) => d.hours.map((h: any) => h.sales)), 1)

  // 表示する時間帯（全heatmapから売上ある時間を抽出）
  const activeHours = Array.from(
  new Set(
    heatmap.flatMap((d: any) =>
      d.hours
        .filter((h: any) => h.sales > 0)
        .map((h: any) => h.hour)
    )
  )
).sort((a, b) => a - b) as number[]

  const peakHour = hourly.reduce((best, h) => h.total_sales > (best?.total_sales ?? 0) ? h : best, null as any)

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">時間帯別分析</h1>
      <p className="text-sm text-gray-500 mb-8">何時台に売上が集中しているかを把握できます。</p>

      {hourly.length === 0 ? (
        <p className="text-gray-400 text-center py-20">データがありません。</p>
      ) : (
        <>
          {/* ピーク時間帯 */}
          {peakHour && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-center gap-3">
              <span className="text-2xl">⚡</span>
              <div>
                <p className="font-semibold text-blue-800">
                  ピーク時間帯：{String(peakHour.hour).padStart(2, '0')}:00〜{String(peakHour.hour + 1).padStart(2, '0')}:00
                </p>
                <p className="text-sm text-blue-600">
                  累計売上 {peakHour.total_sales.toLocaleString()} 円 / {peakHour.txn_count} 取引
                </p>
              </div>
            </div>
          )}

          {/* 時間帯別棒グラフ */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
            <h2 className="text-base font-semibold text-gray-700 mb-4">時間帯別 累計売上</h2>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={hourly} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v: number) => [`${v.toLocaleString()} 円`, '売上']}
                  labelFormatter={l => `${l}台`}
                />
                <Bar dataKey="total_sales" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 曜日×時間帯ヒートマップ */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-700 mb-1">曜日 × 時間帯 ヒートマップ</h2>
            <p className="text-xs text-gray-400 mb-4">色が濃いほど売上が高い時間帯です</p>

            {activeHours.length === 0 ? (
              <p className="text-gray-400 text-sm">データがありません</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="text-xs border-collapse">
                  <thead>
                    <tr>
                      <th className="w-8 pr-2 text-gray-400 text-right font-normal"></th>
                      {DAY_LABELS.map(d => (
                        <th key={d} className="w-12 text-center text-gray-600 font-semibold pb-2">{d}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {activeHours.map(h => (
                      <tr key={h}>
                        <td className="pr-2 text-right text-gray-400 font-mono">
                          {String(h).padStart(2, '0')}
                        </td>
                        {heatmap.map((dayData: any) => {
                          const hourData = dayData.hours.find((hd: any) => hd.hour === h)
                          const sales    = hourData?.sales ?? 0
                          return (
                            <td key={dayData.day} className="p-0.5">
                              <div
                                className="w-11 h-9 rounded flex items-center justify-center text-white text-[10px] font-medium"
                                style={{ background: heatColor(sales, maxHeat) }}
                                title={`${dayData.label}曜 ${String(h).padStart(2, '0')}:00 - ${sales.toLocaleString()}円`}
                              >
                                {sales > 0 ? `${Math.round(sales / 1000)}k` : ''}
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {/* 凡例 */}
                <div className="flex items-center gap-2 mt-4">
                  <span className="text-xs text-gray-400">低</span>
                  {['#F3F4F6','#DBEAFE','#93C5FD','#3B82F6','#1D4ED8'].map(c => (
                    <div key={c} className="w-6 h-4 rounded" style={{ background: c }} />
                  ))}
                  <span className="text-xs text-gray-400">高</span>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
