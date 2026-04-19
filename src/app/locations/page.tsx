'use client'

import { useEffect, useState } from 'react'
import { ApiClientError, fetchApi } from '@/lib/api-client'
import { useDraftForm } from '@/lib/use-draft-form'
import { useSubmissionFeedback } from '@/lib/use-submission-feedback'
import type { LocationUpsertPayload, MutationSuccessPayload } from '@/types/api-payloads'
import type { ManagedLocation as Location } from '@/types/operations'

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const {
    pending: submitting,
    message: result,
    error,
    setError,
    start,
    succeed,
    stop,
  } = useSubmissionFeedback()

  const { form, setForm, clearDraft } = useDraftForm('draft:locations-form', {
    name: '',
    address: '',
  })

  async function loadLocations() {
    try {
      const data = await fetchApi<Location[]>('/api/locations', { cache: 'no-store' })
      setLocations(data)
      setError(null)
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : '出店場所一覧の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLocations()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.name.trim() || !form.address.trim()) {
      setError('場所名と住所は必須です')
      return
    }

    start()

    try {
      const result = await fetchApi<LocationUpsertPayload>('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          address: form.address.trim(),
        }),
      })
      const location = result?.location ?? null
      const geocoded = result?.geocoded ?? null

      succeed(
        `場所を登録しました。住所: ${location?.address ?? '-'}${
          geocoded ? ` / 座標取得: ${String(geocoded).slice(0, 40)}...` : ''
        }`
      )

      setForm({
        name: '',
        address: '',
      })
      clearDraft()

      void loadLocations()
    } catch (err) {
      stop()
      setError(err instanceof ApiClientError ? err.message : '通信エラーが発生しました')
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`「${name}」を削除しますか？`)) return

    try {
      await fetchApi<MutationSuccessPayload>(`/api/locations/${id}`, { method: 'DELETE' })
      void loadLocations()
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : '削除に失敗しました')
    }
  }

  return (
    <div>
      <div className="mb-6">
        <div className="badge-green badge-soft inline-block mb-3">入力</div>
        <h1 className="section-title text-3xl font-bold mb-2">出店場所登録</h1>
        <p className="section-subtitle text-sm">
          出店する場所を先に登録しておくと、出店ログ入力や分析で選びやすくなります。
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="soft-panel p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">📍</span>
            <h2 className="section-title text-lg font-semibold">出店場所を登録する</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-main mb-1">場所名 *</label>
              <input
                type="text"
                required
                placeholder="例: Asobiya"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="soft-input w-full px-3 py-2 text-sm"
              />
              <p className="text-xs text-sub mt-1">
                実際に見分けやすい名前をつけてください
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-main mb-1">住所 *</label>
              <input
                type="text"
                required
                placeholder="例: 茨城県鹿嶋市"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                className="soft-input w-full px-3 py-2 text-sm"
              />
              <p className="text-xs text-sub mt-1">
                住所は市町村まで入力してください（例: 茨城県鹿嶋市）
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
              disabled={submitting}
              className="soft-button w-full bg-blue-600 text-white rounded-full py-3 font-semibold hover:bg-blue-700 disabled:opacity-40 shadow-sm"
            >
              {submitting ? '登録中...' : '場所を登録する'}
            </button>
          </form>
        </div>

        <div className="soft-panel p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">🗂️</span>
            <h2 className="section-title text-lg font-semibold">
              登録済み出店場所（{locations.length}件）
            </h2>
          </div>

          {loading ? (
            <p className="section-subtitle text-sm">読み込み中...</p>
          ) : locations.length === 0 ? (
            <p className="section-subtitle text-sm">まだ登録されていません</p>
          ) : (
            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
              {locations.map((loc) => (
                <div
                  key={loc.id}
                  className="soft-card p-4 flex items-start justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-main truncate">{loc.name}</p>
                    <p className="text-xs text-sub mt-1 truncate">{loc.address}</p>
                    {loc.latitude != null && loc.longitude != null && (
                      <p className="text-xs text-soft mt-1">
                        {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => handleDelete(loc.id, loc.name)}
                    className="soft-button text-xs text-red-500 hover:text-red-700 whitespace-nowrap mt-1"
                  >
                    削除
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
