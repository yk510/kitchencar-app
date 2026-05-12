'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ApiClientError, fetchApi } from '@/lib/api-client'
import type {
  AudioAnalyticsHourlyPayload,
  AudioAnalyticsHourlyRow,
  AudioOrderEventListPayload,
  AudioOrderEventListRow,
  AudioAnalyticsProductsPayload,
  AudioAnalyticsProductRow,
  AudioTranscriptImportResultPayload,
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

function formatSessionDisplay(value: string) {
  return value.length > 18 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value
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
  const [importResult, setImportResult] = useState<AudioTranscriptImportResultPayload | null>(null)

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
    setImportResult(null)

    try {
      const text = await importFile.text()
      const payload = JSON.parse(text)

      const data = await fetchApi<AudioTranscriptImportResultPayload>('/api/audio/import-transcripts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      setImportResult(data)
      setImportMessage(
        data.unmatched_transcript_count > 0
          ? `取込完了: chunk ${data.chunk_count}件 / transcript ${data.transcript_count}件 / 抽出成功 ${data.matched_transcript_count}件 / 未抽出 ${data.unmatched_transcript_count}件`
          : `取込完了: chunk ${data.chunk_count}件 / transcript ${data.transcript_count}件 / 注文イベント ${data.order_event_count}件`
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
    <div className="space-y-6">
      <div className="soft-panel rounded-[32px] border border-[#efe7d7] bg-[linear-gradient(180deg,#fffdf9_0%,#fff8ee_100%)] px-8 py-8">
        <div className="inline-flex rounded-full bg-[#fff1cf] px-3 py-1 text-[11px] font-semibold tracking-[0.08em] text-[#a96a11]">
          Experimental audio analytics
        </div>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-main">音声ダッシュボード</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-sub">
          店員音声から推定した商品別販売数と、時間帯別の注文傾向を確認します。転記用の集計と、イベント単位の明細を同じ画面で見られる状態にしています。
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Link
            href="/audio-analytics/transcripts"
            className="inline-flex items-center rounded-2xl bg-[#2f5fd0] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#244fb4]"
          >
            音声Transcriptを見る
          </Link>
          <span className="text-xs text-sub">
            認識テキストと未抽出発話の確認はこちら
          </span>
        </div>
        <div className="mt-5 flex flex-wrap gap-3 text-xs text-sub">
          <span className="rounded-full bg-white/90 px-3 py-1 ring-1 ring-[#ebe3d4]">
            推定販売数 {formatCount(summary.totalQuantity)} 個
          </span>
          <span className="rounded-full bg-white/90 px-3 py-1 ring-1 ring-[#ebe3d4]">
            注文イベント {formatCount(summary.totalOrders)} 件
          </span>
          {sessionId.trim() && (
            <span className="rounded-full bg-white/90 px-3 py-1 ring-1 ring-[#ebe3d4]">
              session {formatSessionDisplay(sessionId.trim())}
            </span>
          )}
        </div>
      </div>

      <div className="soft-panel rounded-[28px] border border-[#f0dfbd] bg-[linear-gradient(180deg,#fffefb_0%,#fff8eb_100%)] px-7 py-6 md:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="inline-flex rounded-full bg-[#fff4dd] px-3 py-1 text-[11px] font-semibold tracking-[0.08em] text-[#b7791f]">
              検証用 transcript import
            </div>
            <h2 className="mt-3 text-lg font-semibold text-main">文字起こしJSONを取り込む</h2>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-sub">
              外部で作った文字起こしデータや、サンプルJSONをそのまま取り込めます。取り込み後は、この画面で商品別集計と注文イベント明細を確認できます。
            </p>
          </div>
          <div className="rounded-full bg-white/90 px-3 py-1 text-xs text-sub ring-1 ring-[#eadfcf]">
            開発・検証向け
          </div>
        </div>

        <div className="mt-5 border-t border-[#efe3cf] pt-5">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
            <label className="block">
              <span className="mb-2 block text-sm text-sub">JSONファイル</span>
              <div className="rounded-[24px] border border-dashed border-[#ddcfba] bg-white px-4 py-4">
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={(event) => {
                    setImportFile(event.target.files?.[0] ?? null)
                    setImportError(null)
                    setImportMessage(null)
                  }}
                  className="w-full text-sm text-main file:mr-4 file:rounded-xl file:border-0 file:bg-[#f4efe6] file:px-4 file:py-2 file:font-semibold file:text-main hover:file:bg-[#ece4d7]"
                />
                <p className="mt-3 text-xs text-sub">
                  {importFile ? `選択中: ${importFile.name}` : 'sample transcript JSON または外部文字起こしJSONを選択してください。'}
                </p>
              </div>
            </label>

            <div className="flex items-end">
              <button
                type="button"
                onClick={handleImport}
                className="min-w-[180px] rounded-2xl bg-[#b7791f] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#9f6518] disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!importFile || importLoading}
              >
                {importLoading ? '取り込み中...' : 'JSONを取り込む'}
              </button>
            </div>
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

        {importResult && (
          <div className="mt-4 rounded-[24px] border border-[#e4ddd2] bg-white px-5 py-5">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl bg-[#fbfaf7] px-4 py-4">
                <p className="text-[11px] font-semibold tracking-[0.08em] text-sub uppercase">chunk</p>
                <p className="mt-2 text-2xl font-bold text-main">{formatCount(importResult.chunk_count)}</p>
              </div>
              <div className="rounded-2xl bg-[#fbfaf7] px-4 py-4">
                <p className="text-[11px] font-semibold tracking-[0.08em] text-sub uppercase">transcript</p>
                <p className="mt-2 text-2xl font-bold text-main">{formatCount(importResult.transcript_count)}</p>
              </div>
              <div className="rounded-2xl bg-[#f0fbf5] px-4 py-4">
                <p className="text-[11px] font-semibold tracking-[0.08em] text-emerald-700 uppercase">抽出成功</p>
                <p className="mt-2 text-2xl font-bold text-emerald-700">{formatCount(importResult.matched_transcript_count)}</p>
              </div>
              <div className="rounded-2xl bg-[#fff7ed] px-4 py-4">
                <p className="text-[11px] font-semibold tracking-[0.08em] text-amber-700 uppercase">未抽出</p>
                <p className="mt-2 text-2xl font-bold text-amber-700">{formatCount(importResult.unmatched_transcript_count)}</p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-[#faf7f1] px-4 py-3 text-sm text-sub">
              session: <span className="font-medium text-main">{formatSessionDisplay(importResult.session.id)}</span>
            </div>

            <div className="mt-4 overflow-x-auto rounded-2xl border border-soft">
              <table className="min-w-full divide-y divide-[var(--line-soft)] bg-white text-sm">
                <thead className="bg-[#fbfaf7]">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-main">chunk</th>
                    <th className="px-4 py-3 text-right font-semibold text-main">transcript</th>
                    <th className="px-4 py-3 text-right font-semibold text-main">抽出成功</th>
                    <th className="px-4 py-3 text-right font-semibold text-main">未抽出</th>
                    <th className="px-4 py-3 text-right font-semibold text-main">注文イベント</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--line-soft)]">
                  {importResult.chunks.map((chunk, index) => (
                    <tr key={chunk.chunk_id}>
                      <td className="px-4 py-3 text-main">{chunk.chunk_label || `chunk ${index + 1}`}</td>
                      <td className="px-4 py-3 text-right text-main">{formatCount(chunk.transcript_count)}</td>
                      <td className="px-4 py-3 text-right text-emerald-700">{formatCount(chunk.matched_transcript_count)}</td>
                      <td className="px-4 py-3 text-right text-amber-700">{formatCount(chunk.unmatched_transcript_count)}</td>
                      <td className="px-4 py-3 text-right text-sub">{formatCount(chunk.order_event_count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {importResult.unmatched_transcript_count > 0 && (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                一部 transcript は商品・数量を抽出できませんでした。`音声Transcriptを見る` から未抽出の発話を確認し、alias 追加や文字起こし見直しに進めます。
              </div>
            )}
          </div>
        )}
      </div>

      <div className="soft-panel rounded-[28px] px-7 py-6 md:px-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-main">集計条件</h2>
            <p className="mt-1 text-sm text-sub">日付と session を指定して、集計対象を絞り込みます。</p>
          </div>
          <div className="rounded-full bg-[#f7f4ee] px-3 py-1 text-xs text-sub">
            転記・検証の両方に使えます
          </div>
        </div>
        <div className="border-t border-[#ece7dd] pt-5">
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
            <div className="soft-card rounded-[28px] border border-[#ece6da] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
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

            <div className="soft-card rounded-[28px] border border-[#ece6da] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
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

          <div className="soft-card rounded-[28px] border border-[#ece6da] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-main">転記用 商品別集計</h2>
                <p className="text-sm text-sub mt-1">
                  指定期間で、どの商品が何個出たかをそのまま確認できます。後からPOSへ手入力する用途を想定しています。
                </p>
              </div>
              <div className="rounded-full bg-[#f5f7ff] px-3 py-1 text-xs font-semibold text-[#355fd1]">
                合計 {formatCount(summary.totalQuantity)} 個
              </div>
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

          <div className="soft-card rounded-[28px] border border-[#ece6da] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-main">注文イベント明細</h2>
                <p className="text-sm text-sub mt-1">
                  裏側では、何時何分に何が何個出たかをイベント単位で保持しています。分析や手動転記の確認に使えます。
                </p>
              </div>
              <div className="rounded-full bg-[#f7f4ee] px-3 py-1 text-xs text-sub">
                明細 {formatCount(eventRows.length)} 件
              </div>
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
                      <th className="px-4 py-3 text-left font-semibold text-main">session</th>
                      <th className="px-4 py-3 text-left font-semibold text-main">商品</th>
                      <th className="px-4 py-3 text-right font-semibold text-main">数量</th>
                      <th className="px-4 py-3 text-left font-semibold text-main">認識テキスト</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--line-soft)]">
                    {eventRows.map((row) => (
                      <tr key={row.id}>
                        <td className="whitespace-nowrap px-4 py-3 text-sub">{formatDateTime(row.event_at)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sub">{formatSessionDisplay(row.session_id)}</td>
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
