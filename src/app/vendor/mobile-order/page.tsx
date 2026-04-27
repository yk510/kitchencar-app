'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ApiClientError, fetchApi } from '@/lib/api-client'
import type { VendorMobileOrderSchedulesPayload } from '@/types/api-payloads'

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function getCurrentSchedule(schedules: VendorMobileOrderSchedulesPayload['schedules']) {
  const now = Date.now()
  return schedules.find((schedule) => {
    if (!['scheduled', 'open'].includes(schedule.status)) return false
    const startsAt = new Date(schedule.opens_at).getTime()
    const endsAt = new Date(schedule.closes_at).getTime()
    return startsAt <= now && now < endsAt
  }) ?? null
}

function getNextSchedule(schedules: VendorMobileOrderSchedulesPayload['schedules']) {
  const now = Date.now()
  return (
    schedules.find((schedule) => new Date(schedule.opens_at).getTime() > now && schedule.status !== 'cancelled') ??
    null
  )
}

export default function VendorMobileOrderPage() {
  const [data, setData] = useState<VendorMobileOrderSchedulesPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [origin, setOrigin] = useState<string | null>(null)
  const [copyMessage, setCopyMessage] = useState<string | null>(null)

  async function load() {
    try {
      const response = await fetchApi<VendorMobileOrderSchedulesPayload>('/api/vendor/mobile-order/schedules', {
        cache: 'no-store',
      })
      setData(response)
      setError(null)
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'モバイルオーダー設定の取得に失敗しました')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  const currentSchedule = useMemo(() => (data ? getCurrentSchedule(data.schedules) : null), [data])
  const nextSchedule = useMemo(() => (data ? getNextSchedule(data.schedules) : null), [data])
  const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID?.trim() ?? null
  const publicUrl = data ? `/order/${data.orderPage.public_token}` : null
  const publicOrderUrl = publicUrl && origin ? new URL(publicUrl, origin).toString() : publicUrl
  const liffOrderUrl = data && liffId
    ? `https://liff.line.me/${liffId}?token=${encodeURIComponent(data.orderPage.public_token)}`
    : null
  const qrTargetUrl = liffOrderUrl ?? publicOrderUrl
  const qrImageUrl = qrTargetUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=16&data=${encodeURIComponent(qrTargetUrl)}`
    : null

  async function handleCopyUrl() {
    if (!qrTargetUrl) return

    try {
      await navigator.clipboard.writeText(qrTargetUrl)
      setCopyMessage(liffOrderUrl ? 'LINE注文URLをコピーしました' : '固定注文URLをコピーしました')
      window.setTimeout(() => setCopyMessage(null), 2500)
    } catch {
      setCopyMessage('URLのコピーに失敗しました')
      window.setTimeout(() => setCopyMessage(null), 2500)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-6">
      <div>
        <div className="badge-blue badge-soft inline-block mb-3">モバイルオーダー</div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">注文受付の準備と確認</h1>
            <p className="text-sm text-gray-500">
              固定QRコードで開く注文ページと、営業時間に応じた受付設定をここから管理します。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/vendor/mobile-order/orders"
              className="rounded-full bg-[var(--accent-blue)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm"
            >
              注文管理を開く
            </Link>
            <Link
              href="/vendor/mobile-order/products"
              className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[var(--accent-blue)] ring-1 ring-[var(--accent-blue-soft)]"
            >
              商品設定へ
            </Link>
          </div>
        </div>
      </div>

        {error && <p className="alert-danger px-4 py-3 text-sm text-red-700">{error}</p>}
        {copyMessage && (
          <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{copyMessage}</p>
        )}

        {loading ? (
          <div className="soft-panel p-6 text-sm text-gray-500">読み込み中...</div>
        ) : data ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <section className="soft-panel p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">店舗</p>
              <h2 className="mt-2 text-lg font-semibold text-gray-800">{data.store.store_name}</h2>
              <p className="mt-2 text-sm text-gray-500">
                注文番号プレフィックス: <span className="font-semibold text-gray-700">{data.store.order_number_prefix}</span>
              </p>
            </section>

            <section className="soft-panel p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">現在の受付</p>
              <p className={`mt-2 text-lg font-semibold ${currentSchedule ? 'text-emerald-700' : 'text-amber-700'}`}>
                {currentSchedule ? '受付中' : '受付時間外'}
              </p>
              <p className="mt-2 text-sm text-gray-500">
                {currentSchedule
                  ? `${formatDateTime(currentSchedule.opens_at)} - ${formatDateTime(currentSchedule.closes_at)}`
                  : '現在有効な営業枠はありません'}
              </p>
            </section>

            <section className="soft-panel p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">次回営業枠</p>
              <p className="mt-2 text-lg font-semibold text-gray-800">
                {nextSchedule ? formatDateTime(nextSchedule.opens_at) : '未設定'}
              </p>
              <p className="mt-2 text-sm text-gray-500">
                {nextSchedule ? `終了 ${formatDateTime(nextSchedule.closes_at)}` : '営業スケジュールを追加してください'}
              </p>
            </section>

            <section className="soft-panel p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">
                {liffOrderUrl ? 'LINE注文URL' : '固定注文URL'}
              </p>
              <p className="mt-2 text-sm font-medium text-gray-700 break-all">{publicOrderUrl ?? '-'}</p>
              <p className="mt-2 text-xs text-gray-500">
                {liffOrderUrl
                  ? 'QRコードはLINE入口URLで生成しています。下のWeb注文URLはブラウザ直接確認用です。'
                  : 'このURLをもとに店頭QRコードを発行します。'}
              </p>
            </section>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.02fr_0.98fr]">
            <section className="soft-panel p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">営業スケジュール</h2>
                  <p className="mt-1 text-sm text-gray-500">営業日と受付時間を設定して、固定QRからの注文受付を制御します。</p>
                </div>
                <Link
                  href="/vendor/mobile-order/schedules"
                  className="rounded-full bg-[var(--accent-blue)] px-4 py-2 text-sm font-semibold text-white"
                >
                  管理画面を開く
                </Link>
              </div>

              <div className="mt-5 space-y-3">
                {data.schedules.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-[var(--line-soft)] bg-white px-5 py-6 text-sm text-gray-500">
                    まだ営業枠がありません。まずは営業スケジュールを追加してください。
                  </div>
                ) : (
                  data.schedules.slice(0, 5).map((schedule) => (
                    <div key={schedule.id} className="rounded-3xl border border-[var(--line-soft)] bg-white px-5 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-gray-800">
                            {formatDateTime(schedule.opens_at)} - {formatDateTime(schedule.closes_at)}
                          </p>
                          <p className="mt-1 text-xs text-gray-500">営業日 {schedule.business_date}</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          {schedule.status}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="soft-panel p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">店頭掲示用QRコード</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    {liffOrderUrl
                      ? 'このQRコードを画像保存すると、LINE入口URL付きでPOP制作に使えます。'
                      : 'このQRコードを画像保存して、CanvaなどでPOP制作に使えます。'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 text-sm">
                  <button
                    type="button"
                    onClick={() => void handleCopyUrl()}
                    disabled={!publicOrderUrl}
                    className="rounded-full bg-slate-100 px-4 py-2 font-medium text-slate-700 transition hover:bg-slate-200 disabled:opacity-50"
                  >
                    URLをコピー
                  </button>
                </div>
              </div>

              <div className="mt-5 rounded-[32px] border border-[var(--line-soft)] bg-white p-5">
                <div className="flex flex-col items-center gap-4 text-center">
                  <div className="flex h-[220px] w-[220px] items-center justify-center rounded-[28px] border border-[var(--line-soft)] bg-[#f8fafc] p-4">
                    {qrImageUrl ? (
                      <img
                        src={qrImageUrl}
                        alt={`${data.store.store_name} の注文用QRコード`}
                        className="h-full w-full rounded-[20px] object-contain"
                      />
                    ) : (
                      <span className="text-sm text-gray-400">QRコードを生成中です</span>
                    )}
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-gray-800">{data.store.store_name}</p>
                    <p className="mt-2 text-sm text-gray-500">
                      {liffOrderUrl
                        ? 'スマホで読み取るとLINEの注文入口が開きます。画像保存してPOP制作に使ってください。'
                        : 'スマホで読み取ると注文ページが開きます。画像保存してPOP制作に使ってください。'}
                    </p>
                    <p className="mt-3 max-w-md break-all text-xs text-gray-500">{qrTargetUrl ?? '-'}</p>
                    {liffOrderUrl && publicOrderUrl ? (
                      <p className="mt-2 max-w-md break-all text-xs text-gray-400">
                        Web確認用: {publicOrderUrl}
                      </p>
                    ) : null}
                  </div>
                  {qrTargetUrl && (
                    <a
                      href={qrTargetUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full bg-white px-4 py-2 text-sm font-medium text-[var(--accent-blue)] ring-1 ring-[var(--accent-blue-soft)] transition hover:bg-[var(--accent-blue-soft)]"
                    >
                      {liffOrderUrl ? 'LINE入口を新しいタブで開く' : '注文ページを新しいタブで開く'}
                    </a>
                  )}
                </div>
              </div>

              <h3 className="mt-6 text-base font-semibold text-gray-800">次の管理導線</h3>
              <div className="mt-4 space-y-3 text-sm text-gray-600">
                <Link
                  href="/vendor/mobile-order/products"
                  className="block rounded-2xl border border-[var(--line-soft)] bg-white px-4 py-3 transition hover:border-[var(--accent-blue)] hover:bg-[var(--accent-blue-soft)]"
                >
                  商品管理: 公開商品、価格、画像、売り切れ制御
                </Link>
                <Link
                  href="/vendor/mobile-order/options"
                  className="block rounded-2xl border border-[var(--line-soft)] bg-white px-4 py-3 transition hover:border-[var(--accent-blue)] hover:bg-[var(--accent-blue-soft)]"
                >
                  オプション管理: トッピング、辛さ、必須/任意設定
                </Link>
                <Link
                  href="/vendor/mobile-order/orders"
                  className="block rounded-2xl border border-[var(--line-soft)] bg-white px-4 py-3 transition hover:border-[var(--accent-blue)] hover:bg-[var(--accent-blue-soft)]"
                >
                  注文ダッシュボード: 受付済、調理中、完成、受取済の更新
                </Link>
                <p className="rounded-2xl border border-[var(--line-soft)] bg-white px-4 py-3">
                  固定QRページ: 一般ユーザーがLINE内から開く注文画面
                </p>
              </div>
            </section>
          </div>
        </>
        ) : null}
      </div>
    </div>
  )
}
