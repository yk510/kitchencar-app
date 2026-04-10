'use client'

import { useState, useEffect } from 'react'

interface ProductRow {
  product_name:  string
  total_sales:   number
  total_qty:     number
  avg_price:     number
  cost_amount:   number | null
  profit:        number | null
  profit_rate:   number | null
  has_cost:      boolean
  is_top3:       boolean
  is_low_margin: boolean
}

export default function ProductAnalyticsPage() {
  const [data, setData]     = useState<ProductRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/analytics/products')
      .then(r => r.json())
      .then(j => { setData(j.data ?? []); setLoading(false) })
  }, [])

  if (loading) return <p className="text-gray-400">読み込み中...</p>

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">商品別分析</h1>
      <p className="text-sm text-gray-500 mb-8">
        利益率50%未満の商品には要改善バッジ、売上上位3件には主力バッジが付きます。
      </p>

      {data.length === 0 ? (
        <p className="text-gray-400 text-center py-20">データがありません。</p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">商品名</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">累計売上</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">販売数</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">平均単価</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">原価</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">利益率</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={row.product_name}
                  className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                    ${row.is_low_margin ? 'bg-red-50' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-gray-800">{row.product_name}</span>
                      {row.is_top3 && (
                        <span className="text-xs bg-yellow-100 text-yellow-800 font-bold px-1.5 py-0.5 rounded-full">
                          主力
                        </span>
                      )}
                      {row.is_low_margin && (
                        <span className="text-xs bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded-full">
                          要改善
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-blue-700">
                    {row.total_sales.toLocaleString()} 円
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">{row.total_qty}</td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {row.avg_price.toLocaleString()} 円
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {row.cost_amount != null
                      ? `${row.cost_amount.toLocaleString()} 円`
                      : <span className="text-gray-300 text-xs">未登録</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {row.profit_rate != null ? (
                      <span className={`font-semibold ${row.is_low_margin ? 'text-red-600' : 'text-green-700'}`}>
                        {row.profit_rate} %
                      </span>
                    ) : (
                      <span className="text-gray-300 text-xs">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
