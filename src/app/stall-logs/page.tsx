'use client'

import { useEffect, useState } from 'react'
import { usePersistentDraft } from '@/lib/usePersistentDraft'

interface Location {
  id: string
  name: string
  address: string
}

interface StallLogResponse {
  stall_log: {
    id: string
    log_date: string
    location_id: string
    event_id: string | null
  }
  updated_transactions: number
  updated_product_sales: number
  event_id?: string | null
}

interface StallLogSummaryResponse {
  unmatched_dates: string[]
  count: number
}

export default function StallLogsPage() {
  const stallDraft = usePersistentDraft('draft:stall-logs-form', {
    logDate: new Date().toISOString().slice(0, 10),
    locationId: '',
    eventName: '',
  })
  const [locations, setLocations] = useState<Location[]>([])
  const { value: draft, setValue: setDraft } = stallDraft
  const { logDate, locationId, eventName } = draft
  const [unmatchedDates, setUnmatchedDates] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function loadUnmatchedDates() {
    try {
      const res = await fetch('/api/stall-logs', { cache: 'no-store' })
      const json: StallLogSummaryResponse | { error?: string } = await res.json()

      if (!res.ok) {
        setError((json as { error?: string }).error ?? '未登録日付の取得に失敗しました')
        return
      }

      setUnmatchedDates((json as StallLogSummaryResponse).unmatched_dates ?? [])
    } catch (e) {
      setError('未登録日付の取得に失敗しました')
    }
  }

  async function loadLocations() {
    try {
      const res = await fetch('/api/locations', { cache: 'no-store' })
      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? '出店場所一覧の取得に失敗しました')
        return
      }

      const fetched = json.data ?? []
      setLocations(fetched)

      if (fetched.length === 1 && !draft.locationId) {
        setDraft((prev) => ({ ...prev, locationId: fetched[0].id }))
      }
    } catch (e) {
      setError('出店場所一覧の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLocations()
    loadUnmatchedDates()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!logDate || !locationId) {
      setError('出店日と出店場所は必須です')
      return
    }

    setSubmitting(true)
    setResult(null)
    setError(null)

    try {
      const res = await fetch('/api/stall-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          log_date: logDate,
          location_id: locationId,
          event_name: eventName.trim() || null,
        }),
      })

      const json: StallLogResponse | { error?: string } = await res.json()

      if (!res.ok) {
        setError((json as any).error ?? '出店ログの登録に失敗しました')
        return
      }

      const selectedLocation = locations.find((loc) => loc.id === locationId)
      const hasEvent = eventName.trim().length > 0

      setResult(
        `出店ログを保存しました。${selectedLocation?.name ?? ''} / ${logDate}` +
          ` / 売上 ${(json as StallLogResponse).updated_transactions}件` +
          ` / 商品 ${(json as StallLogResponse).updated_product_sales}件 を紐付けました。` +
          (hasEvent ? ' / イベント情報も登録しました。' : '') +
          ' / 天候情報も更新しました。'
      )

      setDraft((prev) => ({ ...prev, eventName: '' }))
      await loadUnmatchedDates()
    } catch (e) {
      setError('通信エラーが発生しました')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <div className="badge-orange badge-soft inline-block mb-3">入力</div>
        <h1 className="section-title text-3xl font-bold mb-2">出店ログ管理</h1>
        <p className="section-subtitle text-sm">
          どの日にどこで出店したかを記録します。イベント名は必要なときだけ入力してください。
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="soft-panel p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">📝</span>
            <h2 className="section-title text-lg font-semibold">新規出店ログ登録</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-main mb-1">出店日 *</label>
              <input
                type="date"
                required
                value={logDate}
                onChange={(e) => setDraft((prev) => ({ ...prev, logDate: e.target.value }))}
                className="soft-input w-full px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-main mb-1">出店場所 *</label>
              <select
                required
                value={locationId}
                onChange={(e) => setDraft((prev) => ({ ...prev, locationId: e.target.value }))}
                disabled={loading || locations.length === 0}
                className="soft-input w-full px-3 py-2 text-sm disabled:bg-gray-100"
              >
                <option value="">
                  {loading
                    ? '読み込み中...'
                    : locations.length === 0
                    ? '先に出店場所を登録してください'
                    : '出店場所を選択してください'}
                </option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} / {loc.address}
                  </option>
                ))}
              </select>
              <p className="text-xs text-sub mt-1">
                出店場所は「出店場所登録」で事前に登録してください
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-main mb-1">
                イベント名（任意）
              </label>
              <input
                type="text"
                placeholder="例: 鹿嶋フードフェス"
                value={eventName}
                onChange={(e) => setDraft((prev) => ({ ...prev, eventName: e.target.value }))}
                className="soft-input w-full px-3 py-2 text-sm"
              />
              <p className="text-xs text-sub mt-1">
                通常出店なら空欄のままで大丈夫です
              </p>
            </div>

            {error && (
              <p className="alert-danger px-3 py-3 text-sm text-red-700">{error}</p>
            )}

            {result && (
              <p className="rounded-2xl border border-green-200 bg-green-50 px-3 py-3 text-sm text-green-700">
                {result}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || loading || locations.length === 0}
              className="soft-button w-full bg-blue-600 text-white rounded-full py-3 font-semibold hover:bg-blue-700 disabled:opacity-40 shadow-sm"
            >
              {submitting ? '保存中...' : '出店ログを保存する'}
            </button>
          </form>
        </div>

        <div className="soft-panel p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">📅</span>
            <h2 className="section-title text-lg font-semibold">未登録の日付</h2>
          </div>

          <p className="text-sm text-sub mb-4">
            売上データはあるのに、まだ出店ログが入っていない日付です。押すと左の入力欄に反映されます。
          </p>

          {unmatchedDates.length === 0 ? (
            <div className="soft-card p-4">
              <p className="text-sm text-sub">未登録の日付はありません。</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                未登録の日付が {unmatchedDates.length} 日あります
              </div>

              <div className="flex flex-wrap gap-2">
                {unmatchedDates.map((date) => {
                  const isSelected = logDate === date

                  return (
                    <button
                      key={date}
                      type="button"
                      onClick={() => setDraft((prev) => ({ ...prev, logDate: date }))}
                      className={`soft-button rounded-full px-4 py-2 text-sm border transition ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-main border-soft hover:border-blue-300 hover:text-blue-700'
                      }`}
                    >
                      {date}
                    </button>
                  )
                })}
              </div>

              <div className="soft-card p-4 text-sm text-sub leading-6">
                <p>・日付を選ぶと、左の「出店日」にそのまま入ります。</p>
                <p>・登録すると、この一覧から自動で消えます。</p>
                <p>・イベント出店の日は、必要に応じてイベント名も入力してください。</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
