'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import EventOfferPreviewCard from '@/components/EventOfferPreviewCard'
import { isStatusUpdateMessage } from '@/lib/applicationMessages'
import { subscribeProfileUpdated } from '@/lib/profile-sync'
import { usePersistentDraft } from '@/lib/usePersistentDraft'

type OfferDetail = {
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
  organizer_name: string
  organizer_contact_name: string | null
  organizer_logo_image_url: string | null
  organizer_instagram_url: string | null
  organizer_x_url: string | null
  organizer_description: string | null
  my_application: {
    id: string
    status: 'inquiry' | 'pending' | 'under_review' | 'accepted' | 'rejected'
    initial_message: string | null
  } | null
}

type MessageRow = {
  id: string
  sender_role: 'vendor' | 'organizer'
  message: string
  created_at: string
}

type ApplicationStatus = 'inquiry' | 'pending' | 'under_review' | 'accepted' | 'rejected'

function formatPeriod(start: string, end?: string | null) {
  return end && end !== start ? `${start} 〜 ${end}` : start
}

function statusLabel(status: ApplicationStatus) {
  if (status === 'accepted') return '出店決定'
  if (status === 'rejected') return '見送り'
  if (status === 'under_review') return '確認中'
  if (status === 'pending') return '応募済み'
  return '質問中'
}

function formatFeeLabel(input: {
  fee_type: OfferDetail['fee_type']
  stall_fee: number | null
  revenue_share_rate: number | null
}) {
  if (input.fee_type === 'free') return '無料'
  if (input.fee_type === 'revenue_share') return `${input.revenue_share_rate ?? '-'}%（売上歩合）`
  if (input.fee_type === 'fixed_plus_revenue_share') {
    return `${input.stall_fee != null ? `${Number(input.stall_fee).toLocaleString()}円` : '-'}（固定） + ${input.revenue_share_rate ?? '-'}%（売上歩合）`
  }
  return input.stall_fee != null ? `${Number(input.stall_fee).toLocaleString()}円（固定）` : '-'
}

function threadMessageLabel(message: MessageRow, initialMessage: string | null) {
  if (isStatusUpdateMessage(message.message)) {
    return '運営からのお知らせ'
  }

  if (message.sender_role === 'organizer') {
    return '主催者からの返信'
  }

  if (initialMessage && message.message === initialMessage) {
    return '応募時メッセージ'
  }

  return '追加メッセージ'
}

function isInitialApplicationMessage(message: MessageRow, initialMessage: string | null) {
  return message.sender_role === 'vendor' && !!initialMessage && message.message === initialMessage
}

export default function VendorOfferDetailPage({ params }: { params: { id: string } }) {
  const questionDraftState = usePersistentDraft(`draft:vendor-offer-question:${params.id}`, '')
  const applicationDraftState = usePersistentDraft(`draft:vendor-offer-application:${params.id}`, '')
  const { hydrated: questionDraftHydrated, setValue: setQuestionDraftStorage, clearDraft: clearQuestionDraft } = questionDraftState
  const { hydrated: applicationDraftHydrated, setValue: setApplicationDraftStorage, clearDraft: clearApplicationDraft } = applicationDraftState
  const [offer, setOffer] = useState<OfferDetail | null>(null)
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [questionDraft, setQuestionDraft] = useState(questionDraftState.value)
  const [applicationDraft, setApplicationDraft] = useState(applicationDraftState.value)
  const [loading, setLoading] = useState(true)
  const [sendingQuestion, setSendingQuestion] = useState(false)
  const [sendingApplication, setSendingApplication] = useState(false)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!questionDraftHydrated) return
    setQuestionDraftStorage(questionDraft)
  }, [questionDraft, questionDraftHydrated, setQuestionDraftStorage])

  useEffect(() => {
    if (!applicationDraftHydrated) return
    setApplicationDraftStorage(applicationDraft)
  }, [applicationDraft, applicationDraftHydrated, setApplicationDraftStorage])

  async function loadOffer() {
    const res = await fetch(`/api/vendor/offers/${params.id}`, { cache: 'no-store' })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? '募集詳細の取得に失敗しました')
      return null
    }
    setOffer(json.data)
    return json.data as OfferDetail
  }

  async function loadMessages(applicationId: string) {
    const res = await fetch(`/api/event-applications/${applicationId}/messages`, { cache: 'no-store' })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'メッセージの取得に失敗しました')
      return
    }
    setMessages(json.data ?? [])
  }

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const detail = await loadOffer()
        if (detail?.my_application?.id) {
          await loadMessages(detail.my_application.id)
        } else {
          setMessages([])
        }
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [params.id])

  useEffect(() => {
    if (!offer?.my_application?.id) return

    const timer = window.setInterval(() => {
      refreshAll()
    }, 15000)

    return () => window.clearInterval(timer)
  }, [offer?.my_application?.id])

  useEffect(() => subscribeProfileUpdated(() => void refreshAll()), [])

  async function refreshAll() {
    const detail = await loadOffer()
    if (detail?.my_application?.id) {
      await loadMessages(detail.my_application.id)
    }
  }

  async function handleInquiry() {
    if (!questionDraft.trim()) return
    setSendingQuestion(true)
    setError(null)
    setMessage(null)

    try {
      if (offer?.my_application?.id) {
        const res = await fetch(`/api/event-applications/${offer.my_application.id}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: questionDraft }),
        })
        const json = await res.json()
        if (!res.ok) {
          setError(json.error ?? '質問の送信に失敗しました')
          return
        }
      } else {
        const res = await fetch('/api/event-applications', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ offer_id: params.id, message: questionDraft, mode: 'inquiry' }),
        })
        const json = await res.json()
        if (!res.ok) {
          setError(json.error ?? '質問の送信に失敗しました')
          return
        }
      }

      setQuestionDraft('')
      clearQuestionDraft()
      setMessage('質問を送りました。返信が来ると右上のお知らせに表示されます。')
      await refreshAll()
    } catch {
      setError('通信エラーが発生しました')
    } finally {
      setSendingQuestion(false)
    }
  }

  async function handleApply() {
    if (!applicationDraft.trim()) return
    setSendingApplication(true)
    setError(null)
    setMessage(null)

    try {
      const res = await fetch('/api/event-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offer_id: params.id, message: applicationDraft, mode: 'application' }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? '応募に失敗しました')
        return
      }

      setApplicationDraft('')
      clearApplicationDraft()
      setMessage('応募を送りました。今後のやり取りはこのページと応募状況から確認できます。')
      await refreshAll()
    } catch {
      setError('通信エラーが発生しました')
    } finally {
      setSendingApplication(false)
    }
  }

  async function handleThreadSend() {
    if (!offer?.my_application?.id || !questionDraft.trim()) return
    setSendingMessage(true)
    setError(null)
    try {
      const res = await fetch(`/api/event-applications/${offer.my_application.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: questionDraft }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'メッセージ送信に失敗しました')
        return
      }
      setQuestionDraft('')
      clearQuestionDraft()
      await refreshAll()
    } catch {
      setError('通信エラーが発生しました')
    } finally {
      setSendingMessage(false)
    }
  }

  const currentApplication = offer?.my_application ?? null
  const canApply = !currentApplication || currentApplication.status === 'inquiry'
  const hasApplication = !!currentApplication?.id
  const questionSectionTitle = hasApplication ? '主催者へ追加メッセージを送る' : '主催者へ質問する'
  const questionSectionDescription = hasApplication
    ? '応募後の補足や確認事項を、主催者へそのまま送れます。'
    : '応募前に確認したいことがあれば、先にメッセージを送れます。'
  const questionPlaceholder = hasApplication
    ? '例: 当日の搬入手順や販売メニューの補足をお送りします。'
    : '例: 電源容量や販売開始前の搬入ルートについて確認したいです。'
  const questionButtonLabel = sendingQuestion || sendingMessage
    ? '送信中...'
    : hasApplication
      ? '追加メッセージを送る'
      : '質問を送る'

  if (loading) {
    return <div className="soft-panel p-6 text-sm text-gray-500">読み込み中...</div>
  }

  if (!offer) {
    return <div className="soft-panel p-6 text-sm text-gray-500">募集が見つかりませんでした。</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="badge-blue badge-soft inline-block mb-3">募集詳細</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">{offer.title}</h1>
          <p className="text-sm text-gray-500">
            {formatPeriod(offer.event_date, offer.event_end_date)} / {offer.venue_name}
          </p>
        </div>
        <Link href="/vendor/offers" className="rounded-full bg-white px-4 py-2 text-sm text-[var(--accent-blue)] ring-1 ring-[var(--line-soft)]">
          募集一覧へ戻る
        </Link>
      </div>

      {error && <p className="alert-danger px-4 py-3 text-sm text-red-700">{error}</p>}
      {message && <p className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</p>}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <div className="soft-panel p-6">
            <div className="flex flex-wrap items-center gap-3">
              {offer.organizer_logo_image_url && (
                <div className="h-14 w-14 overflow-hidden rounded-2xl border border-[var(--line-soft)] bg-white">
                  <img src={offer.organizer_logo_image_url} alt="主催者ロゴ" className="h-full w-full object-cover" />
                </div>
              )}
              <span className="badge-soft badge-blue">{offer.organizer_name}</span>
              {offer.my_application && (
                <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                  {statusLabel(offer.my_application.status)}
                </span>
              )}
            </div>
            <div className="mt-4">
              <EventOfferPreviewCard
                badges={offer.my_application ? [{ label: statusLabel(offer.my_application.status), tone: 'green' }] : []}
                title={offer.title}
                periodLabel={formatPeriod(offer.event_date, offer.event_end_date)}
                venueName={offer.venue_name}
                venueAddress={offer.venue_address}
                municipality={offer.municipality}
                recruitmentCount={offer.recruitment_count}
                feeLabel={formatFeeLabel(offer)}
                applicationDeadline={offer.application_deadline}
                loadInStartTime={offer.load_in_start_time}
                loadInEndTime={offer.load_in_end_time}
                salesStartTime={offer.sales_start_time}
                salesEndTime={offer.sales_end_time}
                loadOutStartTime={offer.load_out_start_time}
                loadOutEndTime={offer.load_out_end_time}
                photoUrls={offer.photo_urls}
                venueFeatures={offer.venue_features}
                recruitmentPurpose={offer.recruitment_purpose}
                requiredEquipment={offer.required_equipment}
                notes={offer.notes}
                providedFacilities={offer.provided_facilities}
                emptyPhotoText="主催者が写真を登録するとここに表示されます"
              />
            </div>

          </div>

          <div className="soft-panel p-6">
            <h2 className="text-lg font-semibold text-gray-800">{questionSectionTitle}</h2>
            <p className="mt-1 text-sm text-gray-500">{questionSectionDescription}</p>
            <textarea
              value={questionDraft}
              onChange={(event) => setQuestionDraft(event.target.value)}
              className="mt-4 min-h-[120px] w-full px-4 py-3"
              placeholder={questionPlaceholder}
            />
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={offer.my_application ? handleThreadSend : handleInquiry}
                disabled={sendingQuestion || sendingMessage || !questionDraft.trim()}
                className="soft-button rounded-full bg-slate-700 px-5 py-3 font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
              >
                {questionButtonLabel}
              </button>
              {offer.my_application?.id && (
                <Link
                  href={`/vendor/applications?application=${offer.my_application.id}`}
                  className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-[var(--accent-blue)] ring-1 ring-[var(--line-soft)]"
                >
                  やり取り一覧を見る
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="soft-panel p-6">
            <h2 className="text-lg font-semibold text-gray-800">この募集に応募する</h2>
            <p className="mt-1 text-sm text-gray-500">出店したい理由やメニュー構成を添えて応募できます。</p>
            <textarea
              value={applicationDraft}
              onChange={(event) => setApplicationDraft(event.target.value)}
              className="mt-4 min-h-[140px] w-full px-4 py-3"
              placeholder="例: スープカレーとラッシーを中心に、ファミリー層向けの提供を予定しています。"
              disabled={!canApply}
            />
            <button
              type="button"
              onClick={handleApply}
              disabled={sendingApplication || !applicationDraft.trim() || !canApply}
              className="soft-button mt-3 w-full rounded-full bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
            >
              {!canApply
                ? 'すでに応募済みです'
                : sendingApplication
                  ? '応募中...'
                  : offer.my_application?.status === 'inquiry'
                    ? 'このやり取りから応募する'
                    : '応募する'}
            </button>
          </div>

          {offer.my_application?.id && (
            <div className="soft-panel p-6">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-gray-800">主催者とのやり取り</h2>
                <Link
                  href={`/vendor/applications?application=${offer.my_application.id}`}
                  className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-[var(--accent-blue)] ring-1 ring-[var(--line-soft)]"
                >
                  やり取り一覧へ
                </Link>
              </div>
              <div className="mt-4 max-h-[420px] space-y-3 overflow-y-auto pr-2">
                {messages.length === 0 ? (
                  <p className="text-sm text-gray-500">まだやり取りはありません。</p>
                ) : (
                  messages.map((entry) => (
                    <div
                      key={entry.id}
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                        isStatusUpdateMessage(entry.message)
                          ? 'mx-auto w-full max-w-full border border-amber-200 bg-amber-50 text-amber-900'
                          : entry.sender_role === 'vendor'
                          ? 'ml-auto bg-[var(--accent-blue)] text-white'
                          : 'bg-[#f3f5f8] text-gray-700'
                      } ${isInitialApplicationMessage(entry, offer.my_application?.initial_message ?? null) ? 'ring-2 ring-blue-200 ring-offset-2' : ''}`}
                    >
                      <p className={`text-[11px] font-semibold ${
                        isStatusUpdateMessage(entry.message)
                          ? 'text-amber-700'
                          : entry.sender_role === 'vendor'
                            ? 'text-blue-100'
                            : 'text-gray-500'
                      }`}>
                        {threadMessageLabel(entry, offer.my_application?.initial_message ?? null)}
                      </p>
                      <p className={isInitialApplicationMessage(entry, offer.my_application?.initial_message ?? null) ? 'mt-1 font-semibold' : ''}>
                        {entry.message}
                      </p>
                      <p className={`mt-2 text-[11px] ${
                        isStatusUpdateMessage(entry.message)
                          ? 'text-amber-700'
                          : entry.sender_role === 'vendor'
                            ? 'text-blue-100'
                            : 'text-gray-400'
                      }`}>
                        {new Date(entry.created_at).toLocaleString('ja-JP')}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="soft-panel p-6">
            <h2 className="text-lg font-semibold text-gray-800">主催者情報</h2>
            <div className="mt-4 space-y-2 text-sm text-gray-600">
              <p>団体名 {offer.organizer_name}</p>
              <p>担当者 {offer.organizer_contact_name || '-'}</p>
            </div>
            {(offer.organizer_instagram_url || offer.organizer_x_url) && (
              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                {offer.organizer_instagram_url && (
                  <a
                    href={offer.organizer_instagram_url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full bg-[#f8fafc] px-4 py-2 font-semibold text-[var(--accent-blue)] ring-1 ring-[var(--line-soft)]"
                  >
                    Instagramを見る
                  </a>
                )}
                {offer.organizer_x_url && (
                  <a
                    href={offer.organizer_x_url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full bg-[#f8fafc] px-4 py-2 font-semibold text-[var(--accent-blue)] ring-1 ring-[var(--line-soft)]"
                  >
                    Xを見る
                  </a>
                )}
              </div>
            )}
            {offer.organizer_description && (
              <p className="mt-4 rounded-2xl bg-[#f8fafc] p-4 text-sm text-gray-700 whitespace-pre-wrap">
                {offer.organizer_description}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
