'use client'

import { useEffect, useState } from 'react'
import EventOfferPreviewCard from '@/components/EventOfferPreviewCard'
import { compressImageFile } from '@/lib/client-image'
import { usePersistentDraft } from '@/lib/usePersistentDraft'

type EventOffer = {
  id: string
  title: string
  event_date: string
  event_end_date: string | null
  venue_name: string
  venue_address: string | null
  municipality: string | null
  recruitment_count: number
  fee_type: 'fixed' | 'revenue_share' | 'fixed_plus_revenue_share' | 'free'
  stall_fee: number | null
  revenue_share_rate: number | null
  application_deadline: string | null
  load_in_start_time: string | null
  load_in_end_time: string | null
  sales_start_time: string | null
  sales_end_time: string | null
  load_out_start_time: string | null
  load_out_end_time: string | null
  provided_facilities: string[] | null
  photo_urls: string[] | null
  venue_features: string | null
  recruitment_purpose: string | null
  required_equipment: string | null
  notes: string | null
  status: 'draft' | 'open' | 'closed'
  is_public: boolean
  application_count: number
  accepted_count: number
}

type OfferForm = {
  title: string
  event_date: string
  event_end_date: string
  venue_name: string
  venue_address: string
  municipality: string
  recruitment_count: string
  fee_type: EventOffer['fee_type']
  stall_fee: string
  revenue_share_rate: string
  application_deadline: string
  load_in_start_time: string
  load_in_end_time: string
  sales_start_time: string
  sales_end_time: string
  load_out_start_time: string
  load_out_end_time: string
  provided_facilities: string[]
  photo_urls: string[]
  venue_features: string
  recruitment_purpose: string
  required_equipment: string
  notes: string
  status: EventOffer['status']
  is_public: boolean
}

const facilityOptions = [
  '空調',
  '電源コンセント',
  'Wi-Fi',
  '水道',
  'トイレ',
  'エレベーター',
  'バックヤード',
  '控室',
  '冷蔵庫',
] as const

function formatStatus(status: EventOffer['status']) {
  if (status === 'open') return '募集中'
  if (status === 'closed') return '募集終了'
  return '下書き'
}

function formatPeriod(start: string, end?: string | null) {
  return end && end !== start ? `${start} 〜 ${end}` : start
}

function formatFeeLabel(input: {
  fee_type: 'fixed' | 'revenue_share' | 'fixed_plus_revenue_share' | 'free'
  stall_fee: number | string | null
  revenue_share_rate: number | string | null
}) {
  if (input.fee_type === 'free') return '無料'
  if (input.fee_type === 'revenue_share') return `${input.revenue_share_rate || '-'}%（売上歩合）`
  if (input.fee_type === 'fixed_plus_revenue_share') {
    return `${input.stall_fee ? `${Number(input.stall_fee).toLocaleString()}円` : '-'}（固定） + ${input.revenue_share_rate || '-'}%（売上歩合）`
  }
  return input.stall_fee ? `${Number(input.stall_fee).toLocaleString()}円（固定）` : '-'
}

function createEmptyForm(): OfferForm {
  return {
    title: '',
    event_date: '',
    event_end_date: '',
    venue_name: '',
    venue_address: '',
    municipality: '',
    recruitment_count: '1',
    fee_type: 'fixed',
    stall_fee: '',
    revenue_share_rate: '',
    application_deadline: '',
    load_in_start_time: '',
    load_in_end_time: '',
    sales_start_time: '',
    sales_end_time: '',
    load_out_start_time: '',
    load_out_end_time: '',
    provided_facilities: [],
    photo_urls: [],
    venue_features: '',
    recruitment_purpose: '',
    required_equipment: '',
    notes: '',
    status: 'draft',
    is_public: true,
  }
}

function offerToForm(offer: EventOffer): OfferForm {
  return {
    title: offer.title,
    event_date: offer.event_date,
    event_end_date: offer.event_end_date ?? '',
    venue_name: offer.venue_name,
    venue_address: offer.venue_address ?? '',
    municipality: offer.municipality ?? '',
    recruitment_count: String(offer.recruitment_count),
    fee_type: offer.fee_type,
    stall_fee: offer.stall_fee != null ? String(offer.stall_fee) : '',
    revenue_share_rate: offer.revenue_share_rate != null ? String(offer.revenue_share_rate) : '',
    application_deadline: offer.application_deadline ?? '',
    load_in_start_time: offer.load_in_start_time ?? '',
    load_in_end_time: offer.load_in_end_time ?? '',
    sales_start_time: offer.sales_start_time ?? '',
    sales_end_time: offer.sales_end_time ?? '',
    load_out_start_time: offer.load_out_start_time ?? '',
    load_out_end_time: offer.load_out_end_time ?? '',
    provided_facilities: offer.provided_facilities ?? [],
    photo_urls: offer.photo_urls ?? [],
    venue_features: offer.venue_features ?? '',
    recruitment_purpose: offer.recruitment_purpose ?? '',
    required_equipment: offer.required_equipment ?? '',
    notes: offer.notes ?? '',
    status: offer.status,
    is_public: offer.is_public,
  }
}

export default function OrganizerOffersPage() {
  const offerDraft = usePersistentDraft<{
    editingOfferId: string | null
    form: OfferForm
  }>('draft:organizer-offers-form', {
    editingOfferId: null,
    form: createEmptyForm(),
  })
  const {
    hydrated: offerDraftHydrated,
    setValue: setOfferDraft,
    clearDraft: clearOfferDraft,
  } = offerDraft
  const [offers, setOffers] = useState<EventOffer[]>([])
  const [editingOfferId, setEditingOfferId] = useState<string | null>(offerDraft.value.editingOfferId)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<OfferForm>(offerDraft.value.form)

  useEffect(() => {
    if (!offerDraftHydrated) return
    setOfferDraft({ editingOfferId, form })
  }, [editingOfferId, form, offerDraftHydrated, setOfferDraft])

  async function loadOffers() {
    try {
      const res = await fetch('/api/organizer/offers', { cache: 'no-store' })
      const json = await res.json()
      setOffers(json.data ?? [])
    } catch {
      setError('募集一覧の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOffers()
  }, [])

  async function handlePhotosChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []).slice(0, Math.max(0, 10 - form.photo_urls.length))
    if (files.length === 0) return

    try {
      const nextPhotos = await Promise.all(
        files.map((file) =>
          compressImageFile(file, {
            maxWidth: 1600,
            maxHeight: 1600,
            quality: 0.8,
          })
        )
      )

      setForm((prev) => ({
        ...prev,
        photo_urls: [...prev.photo_urls, ...nextPhotos].slice(0, 10),
      }))
    } catch {
      setError('画像の読み込みに失敗しました')
    } finally {
      event.target.value = ''
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    const editingOffer = editingOfferId ? offers.find((offer) => offer.id === editingOfferId) ?? null : null
    if (editingOffer && editingOffer.application_count > 0) {
      const confirmedCount = editingOffer.accepted_count ?? 0
      const proceed = window.confirm(
        `この募集にはすでに ${editingOffer.application_count} 件の応募があります。保存すると応募中・出店決定済みの事業者へ更新通知が送られます。\n\n出店決定済み: ${confirmedCount} 件\n必要に応じて、個別メッセージでも補足連絡するのがおすすめです。\n\nこのまま更新しますか？`
      )
      if (!proceed) return
    }

    setSaving(true)
    setMessage(null)
    setError(null)

    try {
      const res = await fetch('/api/organizer/offers', {
        method: editingOfferId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingOfferId,
          ...form,
          recruitment_count: Number(form.recruitment_count),
          fee_type: form.fee_type,
          stall_fee: form.stall_fee,
          revenue_share_rate: form.revenue_share_rate,
          provided_facilities: form.provided_facilities,
          photo_urls: form.photo_urls,
        }),
      })
      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? (editingOfferId ? '募集の更新に失敗しました' : '募集の作成に失敗しました'))
        return
      }

      setMessage(editingOfferId ? '募集内容を更新しました' : '募集を保存しました')
      if (editingOfferId && json.data) {
        setForm(offerToForm(json.data))
      } else {
        setForm(createEmptyForm())
      }
      clearOfferDraft()
      setLoading(true)
      loadOffers()
    } catch {
      setError('通信エラーが発生しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="badge-blue badge-soft inline-block mb-3">募集管理</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">{editingOfferId ? 'キッチンカー募集を編集する' : 'キッチンカー募集を作る'}</h1>
        <p className="text-sm text-gray-500">
          写真や開催背景も含めて、ベンダーが応募判断しやすい募集ページを作れます。
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="soft-panel p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {editingOfferId && (
              <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-amber-900">この募集を編集中です</p>
                    <p className="mt-1 text-sm text-amber-800">保存すると、既に応募している事業者へ更新通知が届きます。</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingOfferId(null)
                      setForm(createEmptyForm())
                      clearOfferDraft()
                      setMessage(null)
                      setError(null)
                    }}
                    className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-amber-900 ring-1 ring-amber-200"
                  >
                    新しい募集を作る
                  </button>
                </div>
              </div>
            )}
            <div className="rounded-3xl border border-[var(--line-soft)] bg-white p-5">
              <h2 className="text-lg font-semibold text-gray-800">基本情報</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">募集名</label>
                  <input
                    value={form.title}
                    onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                    className="w-full px-4 py-3"
                    placeholder="例: 5月駅前マルシェ 出店募集"
                    required
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">開催場所</label>
                  <input
                    value={form.venue_name}
                    onChange={(event) => setForm((prev) => ({ ...prev, venue_name: event.target.value }))}
                    className="w-full px-4 py-3"
                    placeholder="例: 鹿嶋市役所前広場"
                    required
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">開始日</label>
                  <input
                    type="date"
                    value={form.event_date}
                    onChange={(event) => setForm((prev) => ({ ...prev, event_date: event.target.value }))}
                    className="w-full px-4 py-3"
                    required
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">終了日</label>
                  <input
                    type="date"
                    value={form.event_end_date}
                    onChange={(event) => setForm((prev) => ({ ...prev, event_end_date: event.target.value }))}
                    className="w-full px-4 py-3"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">市町村</label>
                  <input
                    value={form.municipality}
                    onChange={(event) => setForm((prev) => ({ ...prev, municipality: event.target.value }))}
                    className="w-full px-4 py-3"
                    placeholder="例: 茨城県鹿嶋市"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">会場住所</label>
                  <input
                    value={form.venue_address}
                    onChange={(event) => setForm((prev) => ({ ...prev, venue_address: event.target.value }))}
                    className="w-full px-4 py-3"
                    placeholder="例: 茨城県鹿嶋市平井1187-1"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-[var(--line-soft)] bg-white p-5">
              <h2 className="text-lg font-semibold text-gray-800">イベント・会場写真</h2>
              <p className="mt-1 text-sm text-gray-500">1枚以上必須です。アップロード時に自動で圧縮するので、重すぎる画像は避けやすくしています。</p>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-[var(--line-soft)] bg-[#f8fafc] p-4">
                <div>
                  <p className="text-sm font-medium text-gray-800">最大10枚まで登録できます</p>
                  <p className="mt-1 text-xs text-gray-500">会場の広さ、来場者イメージ、設営環境が伝わる写真がおすすめです。</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${form.photo_urls.length > 0 ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                  {form.photo_urls.length} / 10枚
                </span>
              </div>

              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotosChange}
                className="mt-4 block w-full text-sm text-gray-600"
              />

              {form.photo_urls.length > 0 && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {form.photo_urls.map((url, index) => (
                    <div key={`${url.slice(0, 24)}-${index}`} className="relative overflow-hidden rounded-2xl border border-[var(--line-soft)] bg-[#f8fafc]">
                      <img src={url} alt={`募集写真 ${index + 1}`} className="h-36 w-full object-cover" />
                      <button
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({
                            ...prev,
                            photo_urls: prev.photo_urls.filter((_, photoIndex) => photoIndex !== index),
                          }))
                        }
                        className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-1 text-xs font-semibold text-red-600"
                      >
                        削除
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-[var(--line-soft)] bg-white p-5">
              <h2 className="text-lg font-semibold text-gray-800">ベンダーに伝えたいこと</h2>
              <p className="mt-1 text-sm text-gray-500">「自分に合うイベントか」を判断できる情報があるほど、応募の質が上がりやすくなります。</p>

              <div className="mt-4 grid gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">イベント・会場の特徴</label>
                  <textarea
                    value={form.venue_features}
                    onChange={(event) => setForm((prev) => ({ ...prev, venue_features: event.target.value }))}
                    className="w-full min-h-[140px] px-4 py-3"
                    placeholder="例: 家族連れが多く、芝生エリアでゆったり過ごす来場者が中心です。昼食需要が高く、甘味やドリンクの回遊も見込めます。"
                    required
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">募集背景・目的</label>
                  <textarea
                    value={form.recruitment_purpose}
                    onChange={(event) => setForm((prev) => ({ ...prev, recruitment_purpose: event.target.value }))}
                    className="w-full min-h-[160px] px-4 py-3"
                    placeholder="例: 来場者の滞在満足度を上げるため、食事系2台・ドリンク系1台を想定して募集しています。地域の回遊性を高めることも目的です。"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-[var(--line-soft)] bg-white p-5">
              <h2 className="text-lg font-semibold text-gray-800">募集条件</h2>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">募集台数</label>
                  <input
                    type="number"
                    min="1"
                    value={form.recruitment_count}
                    onChange={(event) => setForm((prev) => ({ ...prev, recruitment_count: event.target.value }))}
                    className="w-full px-4 py-3"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">出店料の形式</label>
                  <select
                    value={form.fee_type}
                    onChange={(event) => setForm((prev) => ({ ...prev, fee_type: event.target.value as EventOffer['fee_type'] }))}
                    className="w-full px-4 py-3"
                  >
                    <option value="fixed">固定</option>
                    <option value="revenue_share">売上歩合</option>
                    <option value="fixed_plus_revenue_share">固定 + 売上歩合</option>
                    <option value="free">無料</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">募集締切</label>
                  <input
                    type="date"
                    value={form.application_deadline}
                    onChange={(event) => setForm((prev) => ({ ...prev, application_deadline: event.target.value }))}
                    className="w-full px-4 py-3"
                  />
                </div>
              </div>

              {(form.fee_type === 'fixed' || form.fee_type === 'fixed_plus_revenue_share') && (
                <div className="mt-4">
                  <label className="mb-2 block text-sm font-medium text-gray-700">固定金額</label>
                  <input
                    type="number"
                    min="0"
                    value={form.stall_fee}
                    onChange={(event) => setForm((prev) => ({ ...prev, stall_fee: event.target.value }))}
                    className="w-full px-4 py-3"
                    placeholder="例: 3000"
                  />
                </div>
              )}

              {(form.fee_type === 'revenue_share' || form.fee_type === 'fixed_plus_revenue_share') && (
                <div className="mt-4">
                  <label className="mb-2 block text-sm font-medium text-gray-700">売上歩合（%）</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={form.revenue_share_rate}
                    onChange={(event) => setForm((prev) => ({ ...prev, revenue_share_rate: event.target.value }))}
                    className="w-full px-4 py-3"
                    placeholder="例: 10"
                  />
                </div>
              )}

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">募集状態</label>
                  <select
                    value={form.status}
                    onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as EventOffer['status'] }))}
                    className="w-full px-4 py-3"
                  >
                    <option value="draft">下書き</option>
                    <option value="open">募集中</option>
                    <option value="closed">募集終了</option>
                  </select>
                </div>
                <label className="mt-7 flex items-center gap-3 rounded-2xl border border-[var(--line-soft)] bg-white px-4 py-3">
                  <input
                    type="checkbox"
                    checked={form.is_public}
                    onChange={(event) => setForm((prev) => ({ ...prev, is_public: event.target.checked }))}
                  />
                  <span className="text-sm text-gray-700">公開募集として扱う</span>
                </label>
              </div>
            </div>

            <div className="rounded-3xl border border-[var(--line-soft)] bg-white p-5">
              <h2 className="text-lg font-semibold text-gray-800">時間・設備・補足</h2>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-[var(--line-soft)] bg-[#f8fafc] p-4">
                  <p className="mb-3 text-sm font-medium text-gray-700">搬入可能時間</p>
                  <div className="grid gap-3">
                    <input type="time" value={form.load_in_start_time} onChange={(event) => setForm((prev) => ({ ...prev, load_in_start_time: event.target.value }))} className="w-full px-4 py-3" />
                    <input type="time" value={form.load_in_end_time} onChange={(event) => setForm((prev) => ({ ...prev, load_in_end_time: event.target.value }))} className="w-full px-4 py-3" />
                  </div>
                </div>
                <div className="rounded-2xl border border-[var(--line-soft)] bg-[#f8fafc] p-4">
                  <p className="mb-3 text-sm font-medium text-gray-700">販売時間</p>
                  <div className="grid gap-3">
                    <input type="time" value={form.sales_start_time} onChange={(event) => setForm((prev) => ({ ...prev, sales_start_time: event.target.value }))} className="w-full px-4 py-3" />
                    <input type="time" value={form.sales_end_time} onChange={(event) => setForm((prev) => ({ ...prev, sales_end_time: event.target.value }))} className="w-full px-4 py-3" />
                  </div>
                </div>
                <div className="rounded-2xl border border-[var(--line-soft)] bg-[#f8fafc] p-4">
                  <p className="mb-3 text-sm font-medium text-gray-700">搬出可能時間</p>
                  <div className="grid gap-3">
                    <input type="time" value={form.load_out_start_time} onChange={(event) => setForm((prev) => ({ ...prev, load_out_start_time: event.target.value }))} className="w-full px-4 py-3" />
                    <input type="time" value={form.load_out_end_time} onChange={(event) => setForm((prev) => ({ ...prev, load_out_end_time: event.target.value }))} className="w-full px-4 py-3" />
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <label className="mb-3 block text-sm font-medium text-gray-700">提供できる設備・什器</label>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {facilityOptions.map((facility) => {
                    const checked = form.provided_facilities.includes(facility)
                    return (
                      <label
                        key={facility}
                        className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
                          checked ? 'border-[var(--accent-blue)] bg-[var(--accent-blue-soft)]' : 'border-[var(--line-soft)] bg-white'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(event) =>
                            setForm((prev) => ({
                              ...prev,
                              provided_facilities: event.target.checked
                                ? [...prev.provided_facilities, facility]
                                : prev.provided_facilities.filter((item) => item !== facility),
                            }))
                          }
                        />
                        <span className="text-sm text-gray-700">{facility}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              <div className="mt-5">
                <label className="mb-2 block text-sm font-medium text-gray-700">必要設備・条件</label>
                <textarea
                  value={form.required_equipment}
                  onChange={(event) => setForm((prev) => ({ ...prev, required_equipment: event.target.value }))}
                  className="w-full min-h-[120px] px-4 py-3"
                  placeholder="例: 発電機不要、水道あり、販売時間 10:00-16:00"
                />
              </div>

              <div className="mt-4">
                <label className="mb-2 block text-sm font-medium text-gray-700">備考</label>
                <textarea
                  value={form.notes}
                  onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                  className="w-full min-h-[120px] px-4 py-3"
                  placeholder="例: 搬入時間、雨天時の扱い、選考基準など"
                />
              </div>
            </div>

            {error && <p className="alert-danger px-4 py-3 text-sm text-red-700">{error}</p>}
            {message && <p className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</p>}

            <button
              type="submit"
              disabled={saving || form.photo_urls.length === 0}
              className="soft-button w-full rounded-full bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
            >
              {saving ? '保存中...' : '募集を保存する'}
            </button>
          </form>
        </div>

        <div className="space-y-6">
          <div className="soft-panel p-6">
            <div className="flex items-center gap-2">
              <span className="text-lg">👀</span>
              <h2 className="text-lg font-semibold text-gray-800">ベンダー向けプレビュー</h2>
            </div>
            <p className="mt-1 text-sm text-gray-500">右側を見ながら、どんな風に見えるか確認できます。</p>
            <div className="mt-4">
              <EventOfferPreviewCard
                badges={[
                  { label: '主催者', tone: 'blue' },
                  { label: formatStatus(form.status as EventOffer['status']), tone: 'slate' },
                ]}
                title={form.title}
                periodLabel={(form.event_date && formatPeriod(form.event_date, form.event_end_date)) || '開催日'}
                venueName={form.venue_name}
                venueAddress={form.venue_address}
                municipality={form.municipality}
                recruitmentCount={form.recruitment_count || '1'}
                feeLabel={formatFeeLabel(form)}
                applicationDeadline={form.application_deadline}
                loadInStartTime={form.load_in_start_time}
                loadInEndTime={form.load_in_end_time}
                salesStartTime={form.sales_start_time}
                salesEndTime={form.sales_end_time}
                loadOutStartTime={form.load_out_start_time}
                loadOutEndTime={form.load_out_end_time}
                photoUrls={form.photo_urls}
                venueFeatures={form.venue_features}
                recruitmentPurpose={form.recruitment_purpose}
                requiredEquipment={form.required_equipment}
                notes={form.notes}
                providedFacilities={form.provided_facilities}
              />
            </div>
          </div>

          <div className="soft-panel p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">📋</span>
              <h2 className="text-lg font-semibold text-gray-800">作成済み募集</h2>
            </div>

            {loading ? (
              <p className="text-sm text-gray-500">読み込み中...</p>
            ) : offers.length === 0 ? (
              <p className="text-sm text-gray-500">まだ募集は作成されていません。</p>
            ) : (
              <div className="space-y-3 max-h-[820px] overflow-y-auto pr-1">
                {offers.map((offer) => (
                  <div key={offer.id} className="soft-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-800">{offer.title}</p>
                        <p className="mt-1 text-sm text-gray-500">
                          {formatPeriod(offer.event_date, offer.event_end_date)} / {offer.venue_name}
                        </p>
                      </div>
                      <span className="badge-soft badge-blue shrink-0">{formatStatus(offer.status)}</span>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-gray-600">
                      <p>募集台数: {offer.recruitment_count} 台</p>
                      <p>出店料: {formatFeeLabel(offer)}</p>
                      <p>写真: {(offer.photo_urls ?? []).length} 枚</p>
                      <p>応募: {offer.application_count} 件 / 出店決定: {offer.accepted_count} 件</p>
                      <p>公開設定: {offer.is_public ? '公開' : '非公開'}</p>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingOfferId(offer.id)
                          setForm(offerToForm(offer))
                          setMessage(null)
                          setError(null)
                          window.scrollTo({ top: 0, behavior: 'smooth' })
                        }}
                        className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-[var(--accent-blue)] ring-1 ring-[var(--line-soft)]"
                      >
                        この募集を編集
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
