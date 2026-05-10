'use client'

import { useEffect, useMemo, useState } from 'react'
import { ApiClientError, fetchApi } from '@/lib/api-client'
import type {
  AudioAnalyticsHourlyPayload,
  AudioAnalyticsHourlyRow,
  AudioAnalyticsProductsPayload,
  AudioAnalyticsProductRow,
} from '@/types/audio-analytics'

function getTodayDateText() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatCount(value: number) {
  return value.toLocaleString()
}

function buildQuery(params: { start?: string; end?: string; sessionId?: string }) {
  const searchParams = new URLSearchParams()
  if (params.start) searchParams.set('start', params.start)
  if (params.end) searchParams.set('end', params.end)
  if (params.sessionId) searchParams.set('session_id', params.sessionId)
  return searchParams.toString()
}

export default function AudioAnalyticsDashboardPage() {
  const [start, setStart] = useState(getTodayDateText())
  const [end, setEnd] = useState(getTodayDateText())
  const [sessionId, setSessionId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [productRows, setProductRows] = useState<AudioAnalyticsProductRow[]>([])
  const [hourlyRows, setHourlyRows] = useState<AudioAnalyticsHourlyRow[]>([])

  async function load(next?: { start?: string; end?: string; sessionId?: string }) {
    setLoading(true)
    setError(null)

    const query = buildQuery({
      start: next?.start ?? start,
      end: next?.end ?? end,
      sessionId: next?.sessionId ?? (sessionId.trim() || undefined),
    })

    try {
      const [products, hourly] = await Promise.all([
        fetchApi<AudioAnalyticsProductsPayload>(`/api/audio/analytics/products?${query}`, {
          cache: 'no-store',
        }),
        fetchApi<AudioAnalyticsHourlyPayload>(`/api/audio/analytics/hourly?${query}`, {
          cache: 'no-store',
        }),
      ])

      setProductRows(products.rows)
      setHourlyRows(hourly.rows)
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : '音声Analyticsの取得に失敗しました')
      setProductRows([])
      setHourlyRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load({
      start: getTodayDateText(),
      end: getTodayDateText(),
      sessionId: '',
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const summary = useMemo(() => {
    const totalQuantity = productRows.reduce((sum, row) => sum + row.total_quantity, 0)
    const totalOrders = hourlyRows.reduce((sum, row) => sum + row.order_event_count, 0)
    const topProduct = productRows[0] ?? null
    const peakHour = [...hourlyRows].sort((left, right) => right.total_quantity - left.total_quantity)[0] ?? null

    return {
      totalQuantity,
      totalOrders,
      topProduct,
      peakHour,
    }
  }, [hourlyRows, productRows])

  const maxHourlyQuantity = Math.max(...hourlyRows.map((row) => row.total_quantity), 1)

  function handleApply() {
    void load({
      start: start.trim() || undefined,
      end: end.trim() || undefined,
      sessionId: sessionId.trim() || undefined,
    })
  }

  function handleClear() {
    const today = getTodayDateText()
    setStart(today)
    setEnd(today)
    setSessionId('')
    void load({
      start: today,
      end: today,
      sessionId: '',
    })
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">音声ダッシュボード</h1>
        <p className="text-sm text-gray-500 mb-6">
          店員音声から推定した商品別販売数と、時間帯別の注文傾向を確認します。
        </p>

        <div className="soft-panel">
          <h2 className="text-lg font-semibold text-main mb-4">集計条件</h2>
          <div className="grid gap-4 md:grid-cols-[180px_180px_1fr_auto_auto] items-end">
            <label className="block">
              <span className="text-sm text-sub block mb-2">開始日</span>
              <input
                type="date"
                value={start}
                onChange={(event) => setStart(event.target.value)}
                className="w-full rounded-2xl border border-soft bg-white px-4 py-3 text-main"
              />
            </label>

            <label className="block">
              <span className="text-sm text-sub block mb-2">終了日</span>
              <input
                type="date"
                value={end}
                onChange={(event) => setEnd(event.target.value)}
                className="w-full rounded-2xl border border-soft bg-white px-4 py-3 text-main"
              />
            </label>

            <label className="block">
              <span className="text-sm text-sub block mb-2">session_id</span>
              <input
                type="text"
                value={sessionId}
                onChange={(event) => setSessionId(event.target.value)}
                placeholder="必要なら session_id で絞り込み"
                className="w-full rounded-2xl border border-soft bg-white px-4 py-3 text-main"
              />
            </label>

            <button
              type="button"
              onClick={handleApply}
              className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-blue-300"
              disabled={loading}
            >
              適用
            </button>

            <button
              type="button"
              onClick={handleClear}
              className="rounded-2xl border border-soft bg-white px-5 py-3 text-sm font-semibold text-main hover:bg-slate-50"
              disabled={loading}
            >
              クリア
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="soft-panel text-center py-20">
          <p className="section-subtitle">読み込み中...</p>
        </div>
      ) : error ? (
        <div className="soft-panel text-center py-20">
          <p className="text-rose-600 font-medium">{error}</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="soft-card p-5 bg-white">
              <p className="text-xs text-sub mb-2">本日の推定販売数</p>
              <p className="text-2xl font-bold text-main">{formatCount(summary.totalQuantity)}</p>
            </div>
            <div className="soft-card p-5 bg-white">
              <p className="text-xs text-sub mb-2">注文イベント件数</p>
              <p className="text-2xl font-bold text-main">{formatCount(summary.totalOrders)}</p>
            </div>
            <div className="soft-card p-5 bg-white">
              <p className="text-xs text-sub mb-2">最多商品</p>
              <p className="text-lg font-semibold text-main">
                {summary.topProduct ? summary.topProduct.product_name : '---'}
              </p>
              <p className="text-sm text-sub mt-2">
                {summary.topProduct ? `${formatCount(summary.topProduct.total_quantity)} 個` : 'データなし'}
              </p>
            </div>
            <div className="soft-card p-5 bg-white">
              <p className="text-xs text-sub mb-2">ピーク時間帯</p>
              <p className="text-lg font-semibold text-main">
                {summary.peakHour ? summary.peakHour.label : '---'}
              </p>
              <p className="text-sm text-sub mt-2">
                {summary.peakHour ? `${formatCount(summary.peakHour.total_quantity)} 個` : 'データなし'}
              </p>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="soft-card p-5 bg-white">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-main">商品ランキング</h2>
                <p className="text-sm text-sub mt-1">推定販売数量の多い順に表示しています。</p>
              </div>

              {productRows.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-soft bg-white p-8 text-center text-sub">
                  商品データがありません。
                </div>
              ) : (
                <div className="space-y-3">
                  {productRows.map((row, index) => (
                    <div key={`${row.product_id ?? 'unknown'}-${row.product_name}`} className="rounded-2xl border border-soft bg-[#fffdf9] p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-700">
                            {index + 1}
                          </span>
                          <div>
                            <p className="font-semibold text-main">{row.product_name}</p>
                            <p className="text-xs text-sub mt-1">注文イベント {formatCount(row.order_event_count)} 件</p>
                          </div>
                        </div>
                        <p className="text-lg font-bold text-main">{formatCount(row.total_quantity)} 個</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="soft-card p-5 bg-white">
              <div className="mb-4">
                <h2 className="text-lg font-semibold text-main">時間帯別推移</h2>
                <p className="text-sm text-sub mt-1">推定販売数量の多い時間帯を確認できます。</p>
              </div>

              {hourlyRows.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-soft bg-white p-8 text-center text-sub">
                  時間帯データがありません。
                </div>
              ) : (
                <div className="space-y-3">
                  {hourlyRows.map((row) => (
                    <div key={row.hour} className="rounded-2xl border border-soft bg-[#fffdf9] p-4">
                      <div className="flex items-center justify-between gap-4 mb-2">
                        <div>
                          <p className="font-semibold text-main">{row.label}</p>
                          <p className="text-xs text-sub mt-1">注文イベント {formatCount(row.order_event_count)} 件</p>
                        </div>
                        <p className="text-lg font-bold text-main">{formatCount(row.total_quantity)} 個</p>
                      </div>
                      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-500"
                          style={{ width: `${Math.max((row.total_quantity / maxHourlyQuantity) * 100, 4)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
