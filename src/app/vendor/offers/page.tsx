'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { subscribeProfileUpdated } from '@/lib/profile-sync'

type OfferRow = {
  id: string
  title: string
  event_date: string
  event_end_date: string | null
  venue_name: string
  municipality: string | null
  recruitment_count: number
  stall_fee: number | null
  application_deadline: string | null
  organizer_name: string
  my_application: {
    id: string
    status: 'inquiry' | 'pending' | 'under_review' | 'accepted' | 'rejected'
    last_message_at: string
  } | null
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

export default function VendorOffersPage() {
  const [offers, setOffers] = useState<OfferRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadOffers() {
    try {
      const res = await fetch('/api/vendor/offers', { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? '募集一覧の取得に失敗しました')
        return
      }
      setOffers(json.data ?? [])
    } catch {
      setError('募集一覧の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadOffers()
  }, [])

  useEffect(() => subscribeProfileUpdated(() => void loadOffers()), [])

  return (
    <div className="space-y-6">
      <div>
        <div className="badge-blue badge-soft inline-block mb-3">募集を探す</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">公開中のキッチンカー募集一覧</h1>
        <p className="text-sm text-gray-500">気になるイベントを選ぶと、詳細の確認や質問、応募ができます。</p>
      </div>

      {error && <p className="alert-danger px-4 py-3 text-sm text-red-700">{error}</p>}

      <div className="space-y-4">
        {loading ? (
          <div className="soft-panel p-6 text-sm text-gray-500">読み込み中...</div>
        ) : offers.length === 0 ? (
          <div className="soft-panel p-6 text-sm text-gray-500">現在公開されている募集はありません。</div>
        ) : (
          offers.map((offer) => (
            <Link
              key={offer.id}
              href={`/vendor/offers/${offer.id}`}
              className="soft-panel block p-6 transition hover:translate-y-[-1px] hover:shadow-md"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="badge-soft badge-blue">{offer.organizer_name}</span>
                    {offer.my_application && (
                      <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                        {statusLabel(offer.my_application.status)}
                      </span>
                    )}
                  </div>
                  <h2 className="mt-3 text-lg font-semibold text-gray-800">{offer.title}</h2>
                  <p className="mt-2 text-sm text-gray-500">
                    {formatPeriod(offer.event_date, offer.event_end_date)} / {offer.venue_name}
                    {offer.municipality ? ` / ${offer.municipality}` : ''}
                  </p>
                </div>
                <div className="text-right text-sm text-gray-500">
                  <p>募集台数 {offer.recruitment_count} 台</p>
                  <p>出店料 {offer.stall_fee != null ? `${Number(offer.stall_fee).toLocaleString()} 円` : '-'}</p>
                  <p>締切 {offer.application_deadline || '-'}</p>
                </div>
              </div>
              <p className="mt-4 text-sm font-medium text-[var(--accent-blue)]">詳細を見て質問・応募する</p>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
