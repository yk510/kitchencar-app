'use client'

import { useEffect, useMemo, useState } from 'react'
import { ApiClientError, fetchApi } from '@/lib/api-client'
import type {
  AudioAnalyticsHourlyPayload,
  AudioAnalyticsHourlyRow,
  AudioOrderEventListPayload,
  AudioOrderEventListRow,
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

function formatDateTime(value: string) {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed)
}

function buildQuery(params: { start?: string; end?: string; sessionId?: string }) {
  const searchParams = new URLSearchParams()
  if (params.start) searchParams.set('start', params.start)
  if (params.end) searchParams.set('end', params.end)
  if (params.sessionId) searchParams.set('session_id', params.sessionId)
  return searchParams.toString()
}

export default function AudioAnalyticsDashboardClient() {
  const [start, setStart] = useState(getTodayDateText())
  const [end, setEnd] = useState(getTodayDateText())
  const [sessionId, setSessionId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [productRows, setProductRows] = useState<AudioAnalyticsProductRow[]>([])
  const [hourlyRows, setHourlyRows] = useState<AudioAnalyticsHourlyRow[]>([])
  const [eventRows, setEventRows] = useState<AudioOrderEventListRow[]>([])
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importLoading, setImportLoading] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importMessage, setImportMessage] = useState<string | null>(null)

  async function load(next?: { start?: string; end?: string; sessionId?: string }) {
    setLoading(true)
    setError(null)

    const query = buildQuery({
      start: next?.start ?? start,
      end: next?.end ?? end,
      sessionId: next?.sessionId ?? (sessionId.trim() || undefined),
    })

    try {
      const [products, hourly, orderEvents] = await Promise.all([
        fetchApi<AudioAnalyticsProductsPayload>(`/api/audio/analytics/products?${query}`, {
          cache: 'no-store',
        }),
        fetchApi<AudioAnalyticsHourlyPayload>(`/api/audio/analytics/hourly?${query}`, {
          cache: 'no-store',
        }),
        fetchApi<AudioOrderEventListPayload>(`/api/audio/order-events?${query}`, {
          cache: 'no-store',
        }),
      ])

      setProductRows(products.rows)
      setHourlyRows(hourly.rows)
      setEventRows(orderEvents.rows)
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : '音声Analyticsの取得に失敗しました')
      setProductRows([])
      setHourlyRows([])
      setEventRows([])
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

  async function handleImport() {
    if (!importFile) return

    setImportLoading(true)
    setImportError(null)
    setImportMessage(null)

    try {
      const text = await importFile.text()
      const payload = JSON.parse(text)

      const data = await fetchApi<{
        session: { id: string }
        chunk_count: number
        transcript_count: number
        order_event_count: number
      }>('/api/audio/import-transcripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      setImportMessage(
        `取込完了: chunk ${data.chunk_count}件 / transcript ${data.transcript_count}件 / 注文イベント ${data.order_event_count}件`
      )

      const nextSessionId = String(data.session?.id ?? '').trim()
      if (nextSessionId) {
        setSessionId(nextSessionId)
        await load({
          start: start.trim() || undefined,
          end: end.trim() || undefined,
          sessionId: nextSessionId,
        })
      } else {
        await load({
          start: start.trim() || undefined,
          end: end.trim() || undefined,
          sessionId: sessionId.trim() || undefined,
        })
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'JSONインポートに失敗しました')
    } finally {
      setImportLoading(false)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">音声ダッシュボード</h1>
        <p className="text-sm text-gray-500 mb-6">
          店員音声から推定した商品別販売数と、時間帯別の注文傾向を確認します。
        </p>

        <div className="soft-panel mb-6 border border-[#f3dfb4] bg-[#fffaf0]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex rounded-full bg-[#fff4dd] px-3 py-1 text-[11px] font-semibold tracking-[0.08em] text-[#b7791f]">
                検証用 transcript import
              </div>
              <h2 className="mt-3 text-lg font-semibold text-main">文字起こしJSONを取り込む</h2>
              <p className="mt-2 text-sm leading-7 text-sub">
                外部で作った文字起こしデータや、サンプルJSONをそのまま取り込めます。取り込み後は、この画面で商品別集計と注文イベント明細を確認できます。
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_auto]">
            <label className="block">
              <span className="mb-2 block text-sm text-sub">JSONファイル</span>
              <input
                type="file"
                accept=".json,application/json"
                onChange={(event) => {
                  setImportFile(event.target.files?.[0] ?? null)
                  setImportError(null)
                  setImportMessage(null)
                }}
                className="w-full rounded-2xl border border-soft bg-white px-4 py-3 text-main"
              />
            </label>

            <div className="flex items-end">
              <button
                type="button"
                onClick={handleImport}
                className="rounded-2xl bg-[#b7791f] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#9f6518] disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!importFile || importLoading}
              >
                {importLoading ? '取り込み中...' : 'JSONを取り込む'}
              </button>
            </div>
          </div>

          {importError && (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {importError}
            </div>
          )}

          {importMessage && (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {importMessage}
            </div>
          )}
        </div>

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
              <p className="text-xs text-sub mb-2">該当期間の推定販売数</p>
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

          <div className="soft-card p-5 bg-white">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-main">転記用 商品別集計</h2>
              <p className="text-sm text-sub mt-1">
                指定期間で、どの商品が何個出たかをそのまま確認できます。後からPOSへ手入力する用途を想定しています。
              </p>
            </div>

            {productRows.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-soft bg-white p-8 text-center text-sub">
                商品別集計データがありません。
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-soft">
                <table className="min-w-full divide-y divide-[var(--line-soft)] bg-white text-sm">
                  <thead className="bg-[#fbfaf7]">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-main">商品名</th>
                      <th className="px-4 py-3 text-right font-semibold text-main">推定数量</th>
                      <th className="px-4 py-3 text-right font-semibold text-main">注文イベント件数</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--line-soft)]">
                    {productRows.map((row) => (
                      <tr key={`${row.product_id ?? 'unknown'}-${row.product_name}`}>
                        <td className="px-4 py-3 text-main">{row.product_name}</td>
                        <td className="px-4 py-3 text-right font-semibold text-main">{formatCount(row.total_quantity)} 個</td>
                        <td className="px-4 py-3 text-right text-sub">{formatCount(row.order_event_count)} 件</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="soft-card p-5 bg-white">
            <div className="mb-4">
              <h2 className="text-lg font-semibold text-main">注文イベント明細</h2>
              <p className="text-sm text-sub mt-1">
                裏側では、何時何分に何が何個出たかをイベント単位で保持しています。分析や手動転記の確認に使えます。
              </p>
            </div>

            {eventRows.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-soft bg-white p-8 text-center text-sub">
                注文イベント明細がありません。
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-soft">
                <table className="min-w-full divide-y divide-[var(--line-soft)] bg-white text-sm">
                  <thead className="bg-[#fbfaf7]">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-main">時刻</th>
                      <th className="px-4 py-3 text-left font-semibold text-main">商品</th>
                      <th className="px-4 py-3 text-right font-semibold text-main">数量</th>
                      <th className="px-4 py-3 text-left font-semibold text-main">認識テキスト</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--line-soft)]">
                    {eventRows.map((row) => (
                      <tr key={row.id}>
                        <td className="whitespace-nowrap px-4 py-3 text-sub">{formatDateTime(row.event_at)}</td>
                        <td className="px-4 py-3 text-main">{row.normalized_product_name ?? row.product_name_raw}</td>
                        <td className="px-4 py-3 text-right font-semibold text-main">{formatCount(row.quantity)} 個</td>
                        <td className="px-4 py-3 text-sub">{row.transcript_text ?? '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
