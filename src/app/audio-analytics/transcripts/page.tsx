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

export default function AudioAnalyticsTranscriptsPage() {
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

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">音声Transcript</h1>
        <p className="text-sm text-gray-500 mb-6">
          音声認識テキストと、そこから抽出した商品・数量を時系列で確認します。
        </p>

        <div className="soft-panel">
          <h2 className="text-lg font-semibold text-main mb-4">絞り込み</h2>
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
      ) : transcripts.length === 0 ? (
        <div className="soft-panel text-center py-20">
          <p className="section-subtitle">この条件に一致する transcript がありません。</p>
        </div>
      ) : (
        <div className="space-y-4">
          {transcripts.map((transcript) => (
            <div key={transcript.id} className="soft-card p-5 bg-white">
              <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
                <div>
                  <p className="text-sm text-sub">{formatDateTime(transcript.spoken_at)}</p>
                  <p className="text-xs text-sub mt-1">
                    speaker: {transcript.speaker_type} / confidence: {formatConfidence(transcript.confidence)}
                  </p>
                </div>
                <div className="text-xs text-sub">
                  <p>session: {transcript.session_id}</p>
                  <p>chunk: {transcript.chunk_id}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-soft bg-[#fffdf9] p-4 mb-4">
                <p className="text-xs text-sub mb-2">認識テキスト</p>
                <p className="text-main whitespace-pre-wrap leading-7">{transcript.transcript_text}</p>
              </div>

              <div>
                <p className="text-xs text-sub mb-2">抽出イベント</p>
                {transcript.extracted_events.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-soft bg-white p-4 text-sm text-sub">
                    抽出された商品・数量はありません。
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2">
                    {transcript.extracted_events.map((event) => (
                      <div
                        key={event.id}
                        className="rounded-2xl border border-soft bg-white p-4"
                      >
                        <p className="text-sm font-semibold text-main">
                          {event.normalized_product_name ?? event.product_name_raw}
                        </p>
                        <p className="text-xs text-sub mt-1">
                          raw: {event.product_name_raw}
                        </p>
                        <div className="mt-3 flex items-center justify-between">
                          <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                            数量 {event.quantity}
                          </span>
                          <span className="text-xs text-sub">
                            confidence: {formatConfidence(event.confidence)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
