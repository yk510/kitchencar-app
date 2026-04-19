'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import MarketplaceMessageItem from '@/components/MarketplaceMessageItem'
import { getApplicationMessagePresentation } from '@/lib/applicationMessages'
import { ApiClientError, fetchApi } from '@/lib/api-client'
import { subscribeProfileUpdated } from '@/lib/profile-sync'
import { usePersistentDraft } from '@/lib/usePersistentDraft'
import type {
  ApplicationMessagesPayload,
  ApplicationMutationPayload,
  ApplicationSendMessagePayload,
  OrganizerApplicationsPayload,
} from '@/types/api-payloads'
import type { MarketplaceMessage, OrganizerApplicationRow, OrganizerProfile } from '@/types/marketplace'

type OrganizerContact = Pick<OrganizerProfile, 'contact_name' | 'contact_email' | 'phone'>

function statusLabel(status: OrganizerApplicationRow['status']) {
  if (status === 'accepted') return '出店決定'
  if (status === 'rejected') return '見送り'
  if (status === 'under_review') return '確認中'
  if (status === 'inquiry') return '質問中'
  return '新着応募'
}

export default function OrganizerApplicationsPage() {
  const draftState = usePersistentDraft('draft:organizer-applications-message', '')
  const { hydrated: draftHydrated, setValue: setDraftStorage, clearDraft } = draftState
  const [applications, setApplications] = useState<OrganizerApplicationRow[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<MarketplaceMessage[]>([])
  const [draft, setDraft] = useState(draftState.value)
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [releasingContact, setReleasingContact] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [organizerContact, setOrganizerContact] = useState<OrganizerContact | null>(null)
  const [showContactModal, setShowContactModal] = useState(false)

  useEffect(() => {
    if (!draftHydrated) return
    setDraftStorage(draft)
  }, [draft, draftHydrated, setDraftStorage])

  async function loadApplications() {
    try {
      const rows = await fetchApi<OrganizerApplicationsPayload>('/api/event-applications', { cache: 'no-store' })
      setApplications(rows)
      setSelectedId((prev) => prev ?? rows[0]?.id ?? null)
    } catch (error) {
      setError(error instanceof ApiClientError ? error.message : '応募一覧の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  async function loadMessages(applicationId: string) {
    try {
      const data = await fetchApi<ApplicationMessagesPayload>(`/api/event-applications/${applicationId}/messages`, {
        cache: 'no-store',
      })
      setMessages(data)
      setApplications((prev) =>
        prev.map((item) => (item.id === applicationId ? { ...item, unread_count: 0 } : item))
      )
    } catch (error) {
      setError(error instanceof ApiClientError ? error.message : 'メッセージの取得に失敗しました')
    }
  }

  async function loadOrganizerContact() {
    try {
      const json = await fetchApi<OrganizerProfile>('/api/organizer/profile', { cache: 'no-store' })
      setOrganizerContact({
        contact_name: json.contact_name ?? null,
        contact_email: json.contact_email ?? null,
        phone: json.phone ?? null,
      })
    } catch (error) {
      setError(error instanceof ApiClientError ? error.message : '主催者設定の取得に失敗しました')
    }
  }

  useEffect(() => {
    loadApplications()
    loadOrganizerContact()
  }, [])

  useEffect(() => {
    if (selectedId) {
      loadMessages(selectedId)
    } else {
      setMessages([])
    }
  }, [selectedId])

  useEffect(() => {
    if (!selectedId) return

    const timer = window.setInterval(() => {
      loadApplications()
      loadMessages(selectedId)
    }, 15000)

    return () => window.clearInterval(timer)
  }, [selectedId])

  useEffect(() => {
    return subscribeProfileUpdated(() => {
      void loadApplications()
      void loadOrganizerContact()
      if (selectedId) {
        void loadMessages(selectedId)
      }
    })
  }, [selectedId])

  async function handleSend() {
    if (!selectedId || !draft.trim()) return
    setSending(true)
    setError(null)

    try {
      await fetchApi<ApplicationSendMessagePayload>(`/api/event-applications/${selectedId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: draft }),
      })
      setDraft('')
      clearDraft()
      loadMessages(selectedId)
      loadApplications()
    } catch (error) {
      setError(error instanceof ApiClientError ? error.message : '通信エラーが発生しました')
    } finally {
      setSending(false)
    }
  }

  async function handleStatusUpdate(status: OrganizerApplicationRow['status']) {
    if (!selectedId) return
    setError(null)

    if (status === 'accepted') {
      const confirmed = window.confirm('相手に出店が決まったことが通知されます。よろしいですか？')
      if (!confirmed) return
    }

    if (status === 'rejected') {
      const confirmed = window.confirm('相手に出店が見送りになったことが通知されます。よろしいですか？')
      if (!confirmed) return
    }

    try {
      await fetchApi<ApplicationMutationPayload>(`/api/event-applications/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      await loadApplications()
      await loadMessages(selectedId)
    } catch (error) {
      setError(error instanceof ApiClientError ? error.message : '状態の更新に失敗しました')
    }
  }

  async function handleReleaseContact() {
    if (!selectedId) return
    if (!organizerContact?.contact_email && !organizerContact?.phone) {
      setError('主催者設定にメールまたは電話番号を入力してから公開してください')
      return
    }

    const confirmed = window.confirm('連絡先情報がベンダー側に通知されます。よろしいですか？')
    if (!confirmed) return

    setReleasingContact(true)
    setError(null)

    try {
      await fetchApi<ApplicationMutationPayload>(`/api/event-applications/${selectedId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ release_contact: true }),
      })
      setShowContactModal(false)
      await loadApplications()
      await loadMessages(selectedId)
    } catch (error) {
      setError(error instanceof ApiClientError ? error.message : '通信エラーが発生しました')
    } finally {
      setReleasingContact(false)
    }
  }

  const selectedApplication = applications.find((item) => item.id === selectedId) ?? null

  return (
    <div className="space-y-6">
      <div>
        <div className="badge-blue badge-soft inline-block mb-3">応募管理</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">応募内容の確認と返答</h1>
        <p className="text-sm text-gray-500">どの事業者から応募が来たか確認して、そのままチャットで返答できます。</p>
      </div>

      {error && <p className="alert-danger px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <div className="soft-panel p-4">
          <h2 className="px-2 text-sm font-semibold text-gray-700">応募一覧</h2>
          <div className="mt-3 space-y-2">
            {loading ? (
              <p className="px-2 py-4 text-sm text-gray-500">読み込み中...</p>
            ) : applications.length === 0 ? (
              <p className="px-2 py-4 text-sm text-gray-500">まだ応募は届いていません。</p>
            ) : (
              applications.map((application) => (
                <div
                  key={application.id}
                  onClick={() => setSelectedId(application.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      setSelectedId(application.id)
                    }
                  }}
                  className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                    application.id === selectedId
                      ? 'border-[var(--accent-blue)] bg-[var(--accent-blue-soft)]'
                      : 'border-[var(--line-soft)] bg-white hover:bg-[#f8fbff]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      href={`/organizer/vendors/${application.vendor_user_id}`}
                      onClick={(event) => event.stopPropagation()}
                      className="text-sm font-semibold text-[var(--accent-blue)] hover:underline"
                    >
                      {application.vendor_name || application.vendor_business_name}
                    </Link>
                    {application.unread_count > 0 && (
                      <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">
                        {application.unread_count}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">{application.offer?.title ?? '募集'}</p>
                  <p className="mt-2 text-xs text-gray-500">{statusLabel(application.status)}</p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="soft-panel p-6">
          {selectedApplication ? (
            <>
              <div className="border-b border-[var(--line-soft)] pb-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/organizer/vendors/${selectedApplication.vendor_user_id}`}
                      className="text-lg font-semibold text-[var(--accent-blue)] hover:underline"
                    >
                      {selectedApplication.vendor_name || selectedApplication.vendor_business_name}
                    </Link>
                    <p className="mt-1 text-sm text-gray-500">
                      {selectedApplication.offer?.title} / {selectedApplication.offer?.venue_name}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleStatusUpdate('under_review')}
                      className="rounded-full bg-slate-100 px-3 py-2 text-sm text-slate-700"
                    >
                      確認中にする
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusUpdate('accepted')}
                      className="rounded-full bg-green-100 px-3 py-2 text-sm text-green-700"
                    >
                      出店決定
                    </button>
                    <button
                      type="button"
                      onClick={() => handleStatusUpdate('rejected')}
                      className="rounded-full bg-red-100 px-3 py-2 text-sm text-red-700"
                    >
                      見送り
                    </button>
                    {selectedApplication.status === 'accepted' && (
                      <button
                        type="button"
                        onClick={() => setShowContactModal(true)}
                        disabled={!!selectedApplication.contact_released_at}
                        className={`rounded-full px-3 py-2 text-sm ${
                          selectedApplication.contact_released_at
                            ? 'bg-slate-100 text-slate-400'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {selectedApplication.contact_released_at ? '連絡先情報を公開済み' : '連絡先情報を公開する'}
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid gap-2 text-sm text-gray-600 md:grid-cols-2">
                  <p>担当者 {selectedApplication.vendor_contact_name || '-'}</p>
                  <p>現在の状態 {statusLabel(selectedApplication.status)}</p>
                  <p className="md:col-span-2">
                    詳しいプロフィールは
                    {' '}
                    <Link
                      href={`/organizer/vendors/${selectedApplication.vendor_user_id}`}
                      className="font-semibold text-[var(--accent-blue)] hover:underline"
                    >
                      ベンダー詳細
                    </Link>
                    {' '}
                    から確認できます。
                  </p>
                </div>

                <div className="mt-4 rounded-2xl bg-[#f8fafc] p-4 text-sm text-gray-700">
                  <p className="font-medium text-gray-800">応募メッセージ</p>
                  <p className="mt-2 whitespace-pre-wrap">{selectedApplication.initial_message || '応募時メッセージはありません。'}</p>
                </div>
              </div>

              <div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-2">
                {messages.length === 0 ? (
                  <p className="text-sm text-gray-500">まだやり取りはありません。</p>
                ) : (
                  messages.map((message) => {
                    const presentation = getApplicationMessagePresentation({
                      message,
                      initialMessage: selectedApplication.initial_message,
                      currentRole: 'organizer',
                    })

                    return (
                      <MarketplaceMessageItem
                        key={message.id}
                        label={presentation.label}
                        message={message.message}
                        createdAt={message.created_at}
                        align={presentation.align}
                        tone={presentation.tone}
                        highlighted={presentation.highlighted}
                      />
                    )
                  })
                )}
              </div>

              <div className="mt-6 border-t border-[var(--line-soft)] pt-4">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  className="min-h-[120px] w-full px-4 py-3"
                  placeholder="応募者へ返答や確認事項を送れます。"
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={sending || !draft.trim()}
                  className="soft-button mt-3 rounded-full bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
                >
                  {sending ? '送信中...' : 'メッセージを送る'}
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500">左から応募を選ぶと、詳細とチャットを表示できます。</p>
          )}
        </div>
      </div>

      {showContactModal && selectedApplication && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-semibold text-gray-800">連絡先情報を公開する</h2>
            <p className="mt-2 text-sm text-gray-500">
              この応募事業者に、主催者の連絡先情報を通知します。公開前に内容を確認してください。
            </p>

            <div className="mt-5 space-y-3 rounded-2xl bg-[#f8fafc] p-4 text-sm text-gray-700">
              <p>担当者名 {organizerContact?.contact_name || '-'}</p>
              <p>メール {organizerContact?.contact_email || '-'}</p>
              <p>電話番号 {organizerContact?.phone || '-'}</p>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowContactModal(false)}
                className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                閉じる
              </button>
              <button
                type="button"
                onClick={handleReleaseContact}
                disabled={releasingContact}
                className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {releasingContact ? '公開中...' : '連絡先情報を公開する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
