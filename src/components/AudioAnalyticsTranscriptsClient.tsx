'use client'

import { useEffect, useState } from 'react'
import { ApiClientError, fetchApi } from '@/lib/api-client'
import type { AudioTranscriptListPayload, AudioTranscriptListRow } from '@/types/audio-analytics'

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value))
}

function formatConfidence(value: number | null | undefined) {
  if (value == null) return '---'
  return `${Math.round(value * 100)}%`
}

function shortId(value: string) {
  return value.length > 14 ? `${value.slice(0, 8)}…${value.slice(-4)}` : value
}

export default function AudioAnalyticsTranscriptsClient() {
  const [transcripts, setTranscripts] = useState<AudioTranscriptListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [sessionId, setSessionId] = useState('')

  async function load(params?: { start?: string; end?: string; sessionId?: string }) {
    setLoading(true)
    setError(null)

    try {
      const searchParams = new URLSearchParams()
      if (params?.start) searchParams.set('start', params.start)
      if (params?.end) searchParams.set('end', params.end)
      if (params?.sessionId) searchParams.set('session_id', params.sessionId)
      searchParams.set('limit', '100')

      const query = searchParams.toString()
      const data = await fetchApi<AudioTranscriptListPayload>(
        `/api/audio/transcripts${query ? `?${query}` : ''}`,
        { cache: 'no-store' }
      )
      setTranscripts(data.transcripts)
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'transcript の取得に失敗しました')
      setTranscripts([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  function handleApply() {
    void load({
      start: start.trim() || undefined,
      end: end.trim() || undefined,
      sessionId: sessionId.trim() || undefined,
    })
  }

  function handleClear() {
    setStart('')
    setEnd('')
    setSessionId('')
    void load()
  }

  const extractedCount = transcripts.filter((item) => item.extracted_events.length > 0).length
  const unmatchedCount = transcripts.length - extractedCount

  return (
    <div className="space-y-6">
      <div className="soft-panel rounded-[32px] border border-[#efe7d7] bg-[linear-gradient(180deg,#fffdf9_0%,#fff8ee_100%)] px-8 py-8">
        <div className="inline-flex rounded-full bg-[#fff1cf] px-3 py-1 text-[11px] font-semibold tracking-[0.08em] text-[#a96a11]">
          Experimental transcript review
        </div>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-main">音声Transcript</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-sub">
          音声認識テキストと、そこから抽出した商品・数量を時系列で確認します。未抽出の発話もそのまま見られるので、alias の追加や認識改善の確認に向いています。
        </p>
        <div className="mt-5 flex flex-wrap gap-3 text-xs text-sub">
          <span className="rounded-full bg-white/90 px-3 py-1 ring-1 ring-[#ebe3d4]">
            transcript {transcripts.length} 件
          </span>
          <span className="rounded-full bg-white/90 px-3 py-1 ring-1 ring-[#ebe3d4]">
            抽出成功 {extractedCount} 件
          </span>
          <span className="rounded-full bg-white/90 px-3 py-1 ring-1 ring-[#ebe3d4]">
            未抽出 {unmatchedCount} 件
          </span>
        </div>
      </div>

      <div className="soft-panel rounded-[28px]">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-main">絞り込み</h2>
            <p className="mt-1 text-sm text-sub">日付と session を指定して transcript を追い込みます。</p>
          </div>
          <div className="rounded-full bg-[#f7f4ee] px-3 py-1 text-xs text-sub">
            最新 100 件を表示
          </div>
        </div>
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

      {loading ? (
        <div className="soft-panel text-center py-20">
          <p className="section-subtitle">読み込み中...</p>
        </div>
      ) : error ? (
        <div className="soft-panel text-center py-20">
          <p className="text-rose-600 font-medium">{error}</p>
        </div>
      ) : transcripts.length === 0 ? (
        <div className="soft-panel text-center py-20">
          <p className="section-subtitle">この条件に一致する transcript がありません。</p>
        </div>
      ) : (
        <div className="space-y-4">
          {transcripts.map((transcript) => (
            <div key={transcript.id} className="soft-card rounded-[28px] border border-[#ece6da] bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#eff6ff] px-3 py-1 text-xs font-semibold text-[#2457c5]">
                      {formatDateTime(transcript.spoken_at)}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        transcript.extracted_events.length > 0
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {transcript.extracted_events.length > 0 ? '抽出済み' : '未抽出'}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-sub">
                    <span className="rounded-full bg-[#f7f4ee] px-3 py-1">
                      speaker: {transcript.speaker_type}
                    </span>
                    <span className="rounded-full bg-[#f7f4ee] px-3 py-1">
                      confidence: {formatConfidence(transcript.confidence)}
                    </span>
                    <span className="rounded-full bg-[#f7f4ee] px-3 py-1">
                      transcript: {shortId(transcript.id)}
                    </span>
                  </div>
                </div>
                <div className="grid gap-2 text-xs text-sub sm:text-right">
                  <div>
                    <p className="font-semibold text-main">session</p>
                    <p>{shortId(transcript.session_id)}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-main">chunk</p>
                    <p>{shortId(transcript.chunk_id)}</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-[24px] border border-soft bg-[#fffdf9] p-5">
                  <p className="text-[11px] font-semibold tracking-[0.08em] text-sub uppercase">認識テキスト</p>
                  <p className="mt-3 whitespace-pre-wrap text-base leading-8 text-main">{transcript.transcript_text}</p>
                </div>

                <div className="rounded-[24px] border border-soft bg-[#fcfbf8] p-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="text-[11px] font-semibold tracking-[0.08em] text-sub uppercase">抽出イベント</p>
                    <span className="rounded-full bg-white px-2.5 py-1 text-xs text-sub ring-1 ring-[#ebe3d4]">
                      {transcript.extracted_events.length} 件
                    </span>
                  </div>
                  {transcript.extracted_events.length === 0 ? (
                    <div className="rounded-[20px] border border-dashed border-[#e8dcc8] bg-white px-4 py-5 text-sm leading-7 text-sub">
                      この発話からは商品・数量を抽出できていません。alias を追加するか、認識テキストを見直す候補です。
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {transcript.extracted_events.map((event) => (
                        <div
                          key={event.id}
                          className="rounded-[20px] border border-[#e8e1d3] bg-white px-4 py-4"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-main">
                                {event.normalized_product_name ?? event.product_name_raw}
                              </p>
                              <p className="mt-1 text-xs text-sub">raw: {event.product_name_raw}</p>
                            </div>
                            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                              数量 {event.quantity}
                            </span>
                          </div>
                          <div className="mt-3 text-xs text-sub">
                            confidence: {formatConfidence(event.confidence)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
