'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { isStatusUpdateMessage } from '@/lib/applicationMessages'
import { subscribeProfileUpdated } from '@/lib/profile-sync'
import { usePersistentDraft } from '@/lib/usePersistentDraft'

type ApplicationRow = {
  id: string
  status: 'inquiry' | 'pending' | 'under_review' | 'accepted' | 'rejected'
  last_message_at: string
  initial_message: string | null
  contact_released_at: string | null
  organizer_name: string | null
  unread_count: number
  offer: {
    id: string
    title: string
    event_date: string
    event_end_date: string | null
    venue_name: string
  } | null
}

type MessageRow = {
  id: string
  sender_role: 'vendor' | 'organizer'
  message: string
  created_at: string
}

function statusLabel(status: ApplicationRow['status']) {
  if (status === 'accepted') return '出店決定'
  if (status === 'rejected') return '見送り'
  if (status === 'under_review') return '確認中'
  if (status === 'inquiry') return '質問中'
  return '応募済み'
}

function messageLabel(message: MessageRow, initialMessage: string | null) {
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

export default function VendorApplicationsPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const requestedApplicationId = searchParams.get('application')
  const requestedHandledRef = useRef(false)
  const draftState = usePersistentDraft('draft:vendor-applications-message', '')
  const { hydrated: draftHydrated, setValue: setDraftStorage, clearDraft } = draftState
  const [applications, setApplications] = useState<ApplicationRow[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [draft, setDraft] = useState(draftState.value)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!draftHydrated) return
    setDraftStorage(draft)
  }, [draft, draftHydrated, setDraftStorage])

  async function loadApplications() {
    try {
      const res = await fetch('/api/event-applications', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? '応募状況の取得に失敗しました')
        return
      }
      const rows = json.data ?? []
      setApplications(rows)
      setSelectedId((prev) => {
        if (
          requestedApplicationId &&
          !requestedHandledRef.current &&
          rows.some((row: ApplicationRow) => row.id === requestedApplicationId)
        ) {
          return requestedApplicationId
        }
        return prev ?? rows[0]?.id ?? null
      })
    } catch {
      setError('応募状況の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  async function loadMessages(applicationId: string) {
    const res = await fetch(`/api/event-applications/${applicationId}/messages`, { cache: 'no-store' })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'メッセージの取得に失敗しました')
      return
    }
    setMessages(json.data ?? [])
    setApplications((prev) =>
      prev.map((item) => (item.id === applicationId ? { ...item, unread_count: 0 } : item))
    )
  }

  useEffect(() => {
    loadApplications()
  }, [])

  useEffect(() => {
    if (!requestedApplicationId) return
    if (!applications.some((item) => item.id === requestedApplicationId)) return
    if (requestedHandledRef.current) return
    requestedHandledRef.current = true
    setSelectedId(requestedApplicationId)
    router.replace(pathname, { scroll: false })
  }, [applications, pathname, requestedApplicationId, router])

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
      const res = await fetch(`/api/event-applications/${selectedId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: draft }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? '送信に失敗しました')
        return
      }
      setDraft('')
      clearDraft()
      loadMessages(selectedId)
      loadApplications()
    } catch {
      setError('通信エラーが発生しました')
    } finally {
      setSending(false)
    }
  }

  const selectedApplication = applications.find((item) => item.id === selectedId) ?? null

  return (
    <div className="space-y-6">
      <div>
        <div className="badge-blue badge-soft inline-block mb-3">応募状況</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">応募した募集とのやり取り</h1>
        <p className="text-sm text-gray-500">主催者からの返答や、追加のやり取りをここで確認できます。</p>
      </div>

      {error && <p className="alert-danger px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <div className="soft-panel p-4">
          <h2 className="px-2 text-sm font-semibold text-gray-700">応募一覧</h2>
          <div className="mt-3 space-y-2">
            {loading ? (
              <p className="px-2 py-4 text-sm text-gray-500">読み込み中...</p>
            ) : applications.length === 0 ? (
              <p className="px-2 py-4 text-sm text-gray-500">まだ応募はありません。</p>
            ) : (
              applications.map((application) => (
                <button
                  key={application.id}
                  type="button"
                  onClick={() => setSelectedId(application.id)}
                  className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                    application.id === selectedId
                      ? 'border-[var(--accent-blue)] bg-[var(--accent-blue-soft)]'
                      : 'border-[var(--line-soft)] bg-white hover:bg-[#f8fbff]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-gray-800">{application.offer?.title ?? '募集'}</span>
                    {application.unread_count > 0 && (
                      <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">
                        {application.unread_count}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    {application.organizer_name || '主催者'} / {application.offer?.venue_name || '-'}
                  </p>
                  <p className="mt-2 text-xs text-gray-500">{statusLabel(application.status)}</p>
                </button>
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
                    <h2 className="text-lg font-semibold text-gray-800">{selectedApplication.offer?.title}</h2>
                    <p className="mt-1 text-sm text-gray-500">
                      {selectedApplication.offer?.event_end_date && selectedApplication.offer.event_end_date !== selectedApplication.offer.event_date
                        ? `${selectedApplication.offer.event_date} 〜 ${selectedApplication.offer.event_end_date}`
                        : selectedApplication.offer?.event_date}{' '}
                      / {selectedApplication.offer?.venue_name}
                    </p>
                  </div>
                  {selectedApplication.offer?.id && (
                    <Link
                      href={`/vendor/offers/${selectedApplication.offer.id}`}
                      className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-[var(--accent-blue)] ring-1 ring-[var(--line-soft)]"
                    >
                      イベント詳細を見る
                    </Link>
                  )}
                </div>
              </div>

              <div className="mt-4 max-h-[520px] space-y-3 overflow-y-auto pr-2">
                {messages.length === 0 ? (
                  <p className="text-sm text-gray-500">まだやり取りはありません。</p>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                        isStatusUpdateMessage(message.message)
                          ? 'mx-auto w-full max-w-full border border-amber-200 bg-amber-50 text-amber-900'
                          : message.sender_role === 'vendor'
                          ? 'ml-auto bg-[var(--accent-blue)] text-white'
                          : 'bg-[#f3f5f8] text-gray-700'
                      } ${isInitialApplicationMessage(message, selectedApplication.initial_message) ? 'ring-2 ring-blue-200 ring-offset-2' : ''}`}
                    >
                      <p className={`text-[11px] font-semibold ${
                        isStatusUpdateMessage(message.message)
                          ? 'text-amber-700'
                          : message.sender_role === 'vendor'
                            ? 'text-blue-100'
                            : 'text-gray-500'
                      }`}>
                        {messageLabel(message, selectedApplication.initial_message)}
                      </p>
                      <p className={isInitialApplicationMessage(message, selectedApplication.initial_message) ? 'mt-1 font-semibold' : ''}>
                        {message.message}
                      </p>
                      <p className={`mt-2 text-[11px] ${
                        isStatusUpdateMessage(message.message)
                          ? 'text-amber-700'
                          : message.sender_role === 'vendor'
                            ? 'text-blue-100'
                            : 'text-gray-400'
                      }`}>
                        {new Date(message.created_at).toLocaleString('ja-JP')}
                      </p>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-6 border-t border-[var(--line-soft)] pt-4">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  className="min-h-[120px] w-full px-4 py-3"
                  placeholder="主催者へ追加メッセージや補足を送れます。"
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={sending || !draft.trim()}
                  className="soft-button mt-3 rounded-full bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
                >
                  {sending ? '送信中...' : '追加メッセージを送る'}
                </button>
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-500">左から応募を選ぶと、やり取りを表示できます。</p>
          )}
        </div>
      </div>
    </div>
  )
}
