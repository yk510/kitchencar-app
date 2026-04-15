'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getDefaultHolidayFlag, getHolidayFlagTone, getWeekdayLabel } from '@/lib/calendar'

type DraftDay = {
  id: string
  plan_date: string
  operation_type: 'open' | 'closed' | 'event'
  holiday_flag: string
  location_id: string | null
  location_name: string
  municipality: string
  event_name: string
  business_start_time: string
  business_end_time: string
  ai_source_text: string
  ai_confidence: string
  notes: string
  weather_type: string
  avg_temperature: string
}

type LocationOption = {
  id: string
  name: string
  address: string
}

function toTimeInputValue(value: string | null | undefined) {
  if (!value) return ''
  return value.slice(0, 5)
}

function normalizeOperationType(value: string, eventName: string) {
  if (value === 'closed') return 'closed'
  return eventName.trim() ? 'event' : 'open'
}

export default function NewPlanPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [sourceImageName, setSourceImageName] = useState('')
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadingReference, setLoadingReference] = useState(true)
  const [loadingWeatherPreview, setLoadingWeatherPreview] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [planMonth, setPlanMonth] = useState('')
  const [days, setDays] = useState<DraftDay[]>([])
  const [locations, setLocations] = useState<LocationOption[]>([])
  const [eventNames, setEventNames] = useState<string[]>([])

  useEffect(() => {
    async function loadReference() {
      try {
        const res = await fetch('/api/plans/reference', { cache: 'no-store' })
        const json = await res.json()
        if (!res.ok) {
          setError(json.error ?? '候補データの取得に失敗しました')
          return
        }

        setLocations(json.locations ?? [])
        setEventNames(json.eventNames ?? [])
      } catch {
        setError('候補データの取得に失敗しました')
      } finally {
        setLoadingReference(false)
      }
    }

    loadReference()
  }, [])

  const sortedDays = useMemo(
    () => [...days].sort((a, b) => a.plan_date.localeCompare(b.plan_date)),
    [days]
  )

  const municipalityOptions = useMemo(
    () => Array.from(new Set(locations.map((location) => location.address))).sort(),
    [locations]
  )

  const weatherPreviewKey = useMemo(
    () =>
      sortedDays
        .map((day) => `${day.id}:${day.plan_date}:${day.operation_type}:${day.municipality}`)
        .join('|'),
    [sortedDays]
  )

  useEffect(() => {
    const weatherPreviewTargets = sortedDays
      .filter((day) => day.operation_type !== 'closed' && day.municipality.trim())
      .map((day) => ({
        id: day.id,
        plan_date: day.plan_date,
        municipality: day.municipality.trim(),
      }))

    if (weatherPreviewTargets.length === 0) {
      setDays((prev) =>
        prev.map((day) =>
          day.operation_type === 'closed'
            ? { ...day, weather_type: '-', avg_temperature: '-' }
            : day
        )
      )
      return
    }

    const timeoutId = window.setTimeout(async () => {
      try {
        setLoadingWeatherPreview(true)

        const res = await fetch('/api/plans/weather-preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ days: weatherPreviewTargets }),
        })

        const json = await res.json()
        if (!res.ok) return

        const previewMap = new Map<string, { weather_type: string | null; avg_temperature: number | null }>()
        for (const item of json.data ?? []) {
          previewMap.set(item.id, item)
        }

        setDays((prev) =>
          prev.map((day) => {
            if (day.operation_type === 'closed') {
              return { ...day, weather_type: '-', avg_temperature: '-' }
            }

            const preview = previewMap.get(day.id)
            return {
              ...day,
              weather_type: preview?.weather_type ?? '',
              avg_temperature:
                preview?.avg_temperature != null ? `${preview.avg_temperature}℃` : '',
            }
          })
        )
      } catch {
        // 予報プレビューは補助情報なので、失敗時は画面を止めない
      } finally {
        setLoadingWeatherPreview(false)
      }
    }, 450)

    return () => window.clearTimeout(timeoutId)
  }, [weatherPreviewKey])

  function updateDay(id: string, patch: Partial<DraftDay>) {
    setDays((prev) => prev.map((day) => (day.id === id ? { ...day, ...patch } : day)))
  }

  function applyLocationName(id: string, rawName: string) {
    const location = locations.find((item) => item.name === rawName.trim())
    if (!location) {
      updateDay(id, {
        location_id: null,
        location_name: rawName,
      })
      return
    }

    updateDay(id, {
      location_id: location.id,
      location_name: location.name,
      municipality: location.address,
    })
  }

  async function handleParse() {
    if (!imageFile) {
      setError('カレンダー画像を選択してください')
      return
    }

    try {
      setParsing(true)
      setError(null)

      const imageDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = () => reject(new Error('画像の読み込みに失敗しました'))
        reader.readAsDataURL(imageFile)
      })

      const res = await fetch('/api/plans/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageDataUrl,
          knownLocations: locations.map((location) => ({
            name: location.name,
            address: location.address,
          })),
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? '予定案の作成に失敗しました')
        return
      }

      const draft = json.draft
      setTitle(draft.title ?? '')
      setPlanMonth(draft.plan_month ?? '')
      setSourceImageName(imageFile.name)
      setDays(
        (draft.days ?? []).map((day: any, index: number) => ({
          id: `${day.date}-${index}`,
          plan_date: day.date ?? '',
          operation_type: day.operation_type ?? 'open',
          holiday_flag: getDefaultHolidayFlag(day.date ?? ''),
          location_id: null,
          location_name: day.location_name ?? '',
          municipality: day.municipality ?? '',
          event_name: day.event_name ?? '',
          business_start_time: toTimeInputValue(day.business_start_time),
          business_end_time: toTimeInputValue(day.business_end_time),
          ai_source_text: day.ai_source_text ?? '',
          ai_confidence: day.ai_confidence != null ? String(day.ai_confidence) : '',
          notes: day.notes ?? '',
          weather_type: '',
          avg_temperature: '',
        }))
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : '予定案の作成に失敗しました')
    } finally {
      setParsing(false)
    }
  }

  async function handleSave() {
    if (!planMonth || sortedDays.length === 0) {
      setError('先に予定案を作成してください')
      return
    }

    const invalidRow = sortedDays.find(
      (day) =>
        day.operation_type !== 'closed' &&
        (!day.location_name.trim() || !day.municipality.trim())
    )
    if (invalidRow) {
      setError(`必須項目が足りません: ${invalidRow.plan_date} の出店場所と市町村を確認してください`)
      return
    }

    try {
      setSaving(true)
      setError(null)

      const res = await fetch('/api/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || null,
          plan_month: planMonth,
          source_image_name: sourceImageName || null,
          days: sortedDays.map((day) => ({
            plan_date: day.plan_date,
            operation_type: normalizeOperationType(day.operation_type, day.event_name),
            holiday_flag: day.holiday_flag || null,
            location_id: day.location_id,
            location_name: day.location_name || null,
            municipality: day.municipality || null,
            event_name: day.event_name || null,
            business_start_time: day.business_start_time ? `${day.business_start_time}:00` : null,
            business_end_time: day.business_end_time ? `${day.business_end_time}:00` : null,
            ai_source_text: day.ai_source_text || null,
            ai_confidence: day.ai_confidence ? Number(day.ai_confidence) : null,
            notes: day.notes || null,
          })),
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? '予定の保存に失敗しました')
        return
      }

      router.push('/plans')
    } catch (err) {
      setError(err instanceof Error ? err.message : '予定の保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">営業予定を作成</h1>
        <p className="text-sm text-gray-500">
          画像から予定案を作ったあと、勤怠入力のような一覧表で一気に確認・修正できます。
        </p>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 mb-6">
        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">カレンダー画像</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const selected = e.target.files?.[0] ?? null
                setImageFile(selected)
                setSourceImageName(selected?.name ?? '')
              }}
              disabled={parsing || saving}
            />
            {imageFile && <p className="text-sm text-gray-500 mt-2">選択中: {imageFile.name}</p>}
          </div>

          <div className="rounded-xl border border-gray-200 bg-slate-50 p-4 text-sm text-gray-600">
            <p className="font-semibold text-gray-700 mb-2">おすすめの流れ</p>
            <p>1. 画像から予定案を作成</p>
            <p>2. 表の中で場所・市町村・イベント名だけ整える</p>
            <p>3. 必要なら休祝日フラグを補正する</p>
            <p>4. 保存して天気予報と売上予測を作る</p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleParse}
          disabled={!imageFile || parsing || saving || loadingReference}
          className="mt-5 rounded-lg bg-blue-600 px-5 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
        >
          {parsing ? 'AIが予定案を作成中...' : '画像から予定案を作る'}
        </button>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {sortedDays.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-1">予定案の確認・修正</h2>
              <p className="text-sm text-gray-500">
                固定情報は読み取り結果を表示し、修正が必要な列だけ入力できるようにしています。
              </p>
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-green-600 px-5 py-3 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-40"
            >
              {saving ? '保存して予測中...' : '確定して予測する'}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-end mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">予定タイトル</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="例: 2026年5月営業予定"
              />
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-gray-100 px-3 py-2 text-gray-600">
                {sortedDays.length}日分
              </span>
              <span className="rounded-full bg-sky-50 px-3 py-2 text-sky-700">
                天気プレビュー {loadingWeatherPreview ? '更新中...' : '反映済み'}
              </span>
            </div>
          </div>

          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            出店場所と市町村は必須です。イベント名が空欄なら通常営業として保存され、新しく入力した場所は保存時に出店場所マスタへ追加されます。
          </div>

          <datalist id="plan-location-options">
            {locations.map((location) => (
              <option key={`${location.name}-${location.address}`} value={location.name} />
            ))}
          </datalist>

          <datalist id="plan-municipality-options">
            {municipalityOptions.map((municipality) => (
              <option key={municipality} value={municipality} />
            ))}
          </datalist>

          <datalist id="plan-event-options">
            {eventNames.map((eventName) => (
              <option key={eventName} value={eventName} />
            ))}
          </datalist>

          <div className="overflow-x-auto">
            <table className="min-w-[1320px] w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="border-b border-gray-200 bg-gray-50 px-3 py-3 font-medium">日付</th>
                  <th className="border-b border-gray-200 bg-gray-50 px-3 py-3 font-medium">曜日</th>
                  <th className="border-b border-gray-200 bg-gray-50 px-3 py-3 font-medium">営業種別</th>
                  <th className="border-b border-gray-200 bg-gray-50 px-3 py-3 font-medium">休祝日フラグ</th>
                  <th className="border-b border-gray-200 bg-gray-50 px-3 py-3 font-medium">出店場所</th>
                  <th className="border-b border-gray-200 bg-gray-50 px-3 py-3 font-medium">市町村</th>
                  <th className="border-b border-gray-200 bg-gray-50 px-3 py-3 font-medium">イベント名</th>
                  <th className="border-b border-gray-200 bg-gray-50 px-3 py-3 font-medium">天候</th>
                  <th className="border-b border-gray-200 bg-gray-50 px-3 py-3 font-medium">気温</th>
                </tr>
              </thead>
              <tbody>
                {sortedDays.map((day) => {
                  const closed = day.operation_type === 'closed'
                  const tone = closed ? 'bg-gray-50' : 'bg-white'

                  return (
                    <tr key={day.id} className={tone}>
                      <td className="border-b border-gray-100 px-3 py-3 align-top">
                        <div className="font-medium text-gray-800">{day.plan_date}</div>
                        {day.ai_confidence && (
                          <div className="mt-1 text-xs text-gray-400">AI {day.ai_confidence}</div>
                        )}
                      </td>
                      <td className="border-b border-gray-100 px-3 py-3 align-top">
                        <span className="font-medium text-gray-700">{getWeekdayLabel(day.plan_date)}</span>
                      </td>
                      <td className="border-b border-gray-100 px-3 py-3 align-top">
                        <select
                          value={day.operation_type}
                          onChange={(e) =>
                            updateDay(day.id, {
                              operation_type: e.target.value as DraftDay['operation_type'],
                              location_id: e.target.value === 'closed' ? null : day.location_id,
                              location_name: e.target.value === 'closed' ? '' : day.location_name,
                              municipality: e.target.value === 'closed' ? '' : day.municipality,
                              event_name: e.target.value === 'closed' ? '' : day.event_name,
                            })
                          }
                          className="w-[120px] rounded-lg border border-gray-300 px-3 py-2 text-sm"
                        >
                          <option value="open">通常営業</option>
                          <option value="event">イベント</option>
                          <option value="closed">休業</option>
                        </select>
                      </td>
                      <td className="border-b border-gray-100 px-3 py-3 align-top">
                        <div className="space-y-2">
                          <select
                            value={day.holiday_flag}
                            onChange={(e) => updateDay(day.id, { holiday_flag: e.target.value })}
                            className="w-[140px] rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          >
                            <option value="">なし</option>
                            <option value="土曜">土曜</option>
                            <option value="日曜">日曜</option>
                            <option value="祝日">祝日</option>
                            <option value="振替休日">振替休日</option>
                            <option value="臨時休業">臨時休業</option>
                          </select>
                          {day.holiday_flag && (
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getHolidayFlagTone(
                                day.holiday_flag
                              )}`}
                            >
                              {day.holiday_flag}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="border-b border-gray-100 px-3 py-3 align-top">
                        <input
                          list="plan-location-options"
                          value={day.location_name}
                          onChange={(e) => applyLocationName(day.id, e.target.value)}
                          disabled={closed}
                          className="w-[220px] rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
                          placeholder="必須"
                        />
                      </td>
                      <td className="border-b border-gray-100 px-3 py-3 align-top">
                        <input
                          list="plan-municipality-options"
                          value={day.municipality}
                          onChange={(e) =>
                            updateDay(day.id, {
                              municipality: e.target.value,
                              location_id:
                                locations.find(
                                  (location) =>
                                    location.name === day.location_name &&
                                    location.address === e.target.value
                                )?.id ?? null,
                            })
                          }
                          disabled={closed}
                          className="w-[190px] rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
                          placeholder="例: 茨城県鹿嶋市"
                        />
                      </td>
                      <td className="border-b border-gray-100 px-3 py-3 align-top">
                        <div className="space-y-1">
                          <input
                            list="plan-event-options"
                            value={day.event_name}
                            onChange={(e) =>
                              updateDay(day.id, {
                                event_name: e.target.value,
                                operation_type:
                                  day.operation_type === 'closed'
                                    ? 'closed'
                                    : normalizeOperationType(day.operation_type, e.target.value),
                              })
                            }
                            disabled={closed}
                            className="w-[220px] rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
                            placeholder="空欄なら通常営業"
                          />
                          <p className="text-xs text-gray-400">空欄なら通常営業扱いです</p>
                        </div>
                      </td>
                      <td className="border-b border-gray-100 px-3 py-3 align-top">
                        <span className="font-medium text-gray-700">
                          {closed ? '-' : day.weather_type || '取得中'}
                        </span>
                      </td>
                      <td className="border-b border-gray-100 px-3 py-3 align-top">
                        <span className="font-medium text-gray-700">
                          {closed ? '-' : day.avg_temperature || '取得中'}
                        </span>
                        {day.ai_source_text && (
                          <p className="mt-1 text-xs text-gray-400">{day.ai_source_text}</p>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
