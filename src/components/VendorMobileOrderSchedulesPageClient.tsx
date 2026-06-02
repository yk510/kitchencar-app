'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ApiClientError, fetchApi } from '@/lib/api-client'
import { stripStoreOrderScheduleMetadata } from '@/lib/store-order-schedule-metadata'
import { useVendorMobileOrderAdminResource } from '@/lib/use-vendor-mobile-order-admin-resource'
import type {
  StoreOrderScheduleRow,
  VendorLocationOption,
  VendorMobileOrderScheduleMutationPayload,
  VendorMobileOrderSchedulesPayload,
} from '@/types/api-payloads'

type ScheduleStatus = StoreOrderScheduleRow['status']

function toLocalInputValue(value: string) {
  const date = new Date(value)
  const offset = date.getTimezoneOffset()
  const adjusted = new Date(date.getTime() - offset * 60_000)
  return adjusted.toISOString().slice(0, 16)
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function getDefaultFormValues() {
  const start = new Date()
  start.setHours(start.getHours() + 1, 0, 0, 0)
  const end = new Date(start)
  end.setHours(end.getHours() + 4)

  return {
    business_date: start.toISOString().slice(0, 10),
    opens_at: toLocalInputValue(start.toISOString()),
    closes_at: toLocalInputValue(end.toISOString()),
    location_id: '',
    event_name: '',
    notes: '',
  }
}

export default function VendorMobileOrderSchedulesPageClient({
  initialData,
}: {
  initialData: VendorMobileOrderSchedulesPayload
}) {
  const { data, loading, error, setError, load } =
    useVendorMobileOrderAdminResource<VendorMobileOrderSchedulesPayload>({
      endpoint: '/api/vendor/mobile-order/schedules',
      initialData,
      errorMessage: '営業スケジュールの取得に失敗しました',
    })
  const [saving, setSaving] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [form, setForm] = useState(getDefaultFormValues())

  const groupedSchedules = useMemo(() => {
    if (!data) return []
    return [...data.schedules].sort((a, b) => {
      const opensDiff = new Date(b.opens_at).getTime() - new Date(a.opens_at).getTime()
      if (opensDiff !== 0) return opensDiff

      const closesDiff = new Date(b.closes_at).getTime() - new Date(a.closes_at).getTime()
      if (closesDiff !== 0) return closesDiff

      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
  }, [data])

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)

    try {
      await fetchApi<VendorMobileOrderScheduleMutationPayload>('/api/vendor/mobile-order/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_date: form.business_date,
          opens_at: new Date(form.opens_at).toISOString(),
          closes_at: new Date(form.closes_at).toISOString(),
          location_id: form.location_id,
          event_name: form.event_name,
          notes: form.notes,
        }),
      })

      setForm(getDefaultFormValues())
      await load()
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : '営業枠の作成に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  async function handleStatusUpdate(id: string, status: ScheduleStatus) {
    setUpdatingId(id)

    try {
      await fetchApi<VendorMobileOrderScheduleMutationPayload>(`/api/vendor/mobile-order/schedules/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      await load()
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : '営業枠の更新に失敗しました')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="badge-blue badge-soft inline-block mb-3">営業スケジュール</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">固定QRの受付時間を管理する</h1>
        <p className="text-sm text-gray-500">
          固定QRコードからの注文を受け付ける日時を設定します。営業時間外は同じURLでも注文できません。
        </p>
      </div>

      {error && <p className="alert-danger px-4 py-3 text-sm text-red-700">{error}</p>}

      {loading ? (
        <div className="soft-panel p-6 text-sm text-gray-500">最新情報を更新中...</div>
      ) : data ? (
        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <section className="soft-panel p-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">営業枠を追加</h2>
              <p className="mt-1 text-sm text-gray-500">
                店舗: {data.store.store_name} / 固定注文ページ: {data.orderPage.page_title}
              </p>
            </div>

            <form onSubmit={handleCreate} className="mt-5 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">営業日</label>
                <input
                  type="date"
                  value={form.business_date}
                  onChange={(event) => setForm((prev) => ({ ...prev, business_date: event.target.value }))}
                  className="w-full px-4 py-3"
                  required
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label className="block text-sm font-medium text-gray-700">出店場所</label>
                    <Link
                      href="/locations"
                      className="text-xs font-medium text-[var(--accent-blue)] underline underline-offset-2"
                    >
                      出店場所登録へ
                    </Link>
                  </div>
                  <select
                    value={form.location_id}
                    onChange={(event) => setForm((prev) => ({ ...prev, location_id: event.target.value }))}
                    className="w-full px-4 py-3"
                    required
                  >
                    <option value="">出店場所を選択してください</option>
                    {data.locations.map((location: VendorLocationOption) => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-gray-500">
                    新しい出店場所が見当たらない場合は、先に「出店場所登録」で追加してください。
                  </p>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">イベント名（任意）</label>
                  <input
                    type="text"
                    value={form.event_name}
                    onChange={(event) => setForm((prev) => ({ ...prev, event_name: event.target.value }))}
                    className="w-full px-4 py-3"
                    placeholder="例: 春のフードフェス"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">受付開始</label>
                  <input
                    type="datetime-local"
                    value={form.opens_at}
                    onChange={(event) => setForm((prev) => ({ ...prev, opens_at: event.target.value }))}
                    className="w-full px-4 py-3"
                    required
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">受付終了</label>
                  <input
                    type="datetime-local"
                    value={form.closes_at}
                    onChange={(event) => setForm((prev) => ({ ...prev, closes_at: event.target.value }))}
                    className="w-full px-4 py-3"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">メモ</label>
                <textarea
                  value={form.notes}
                  onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                  className="w-full min-h-[120px] px-4 py-3"
                  placeholder="例: ランチ営業 / 雨天中止予定 / 会場西ゲート"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="rounded-full bg-[var(--accent-blue)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? '追加中...' : '営業枠を追加'}
              </button>
            </form>
          </section>

          <section className="soft-panel p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">登録済みの営業枠</h2>
                <p className="mt-1 text-sm text-gray-500">状態の切り替えで当日の受付制御もできます。</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {groupedSchedules.length} 件
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {groupedSchedules.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-[var(--line-soft)] bg-white px-5 py-6 text-sm text-gray-500">
                  まだ営業枠がありません。左のフォームから最初の営業枠を追加してください。
                </div>
              ) : (
                groupedSchedules.map((schedule) => (
                  <div key={schedule.id} className="rounded-3xl border border-[var(--line-soft)] bg-white px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">
                          {formatDateTime(schedule.opens_at)} - {formatDateTime(schedule.closes_at)}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">営業日 {schedule.business_date}</p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
                            出店場所:{' '}
                            {schedule.location_id
                              ? data.locations.find((location) => location.id === schedule.location_id)?.name ?? '未設定'
                              : '未設定'}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
                            イベント名: {schedule.event_name ?? 'なし'}
                          </span>
                        </div>
                        {stripStoreOrderScheduleMetadata(schedule.notes) && (
                          <p className="mt-2 text-sm text-gray-600">{stripStoreOrderScheduleMetadata(schedule.notes)}</p>
                        )}
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        {schedule.status}
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {(['scheduled', 'open', 'closed', 'cancelled'] as ScheduleStatus[]).map((status) => (
                        <button
                          key={status}
                          type="button"
                          disabled={updatingId === schedule.id || schedule.status === status}
                          onClick={() => void handleStatusUpdate(schedule.id, status)}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                            schedule.status === status
                              ? 'bg-[var(--accent-blue)] text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          } disabled:opacity-50`}
                        >
                          {updatingId === schedule.id && schedule.status !== status ? '更新中...' : status}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}
