'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { ApiClientError, fetchApi } from '@/lib/api-client'
import type {
  MobileOrderNotificationRow,
  VendorMobileOrderDashboardOrder,
  VendorMobileOrderOrderMutationPayload,
  VendorMobileOrderOrdersPayload,
} from '@/types/api-payloads'

const NOTIFICATION_STORAGE_KEY = 'mobile-order-dashboard-notifications-enabled'

const STATUS_LABELS: Record<string, string> = {
  placed: '受付済',
  preparing: '調理中',
  ready: '完成',
  picked_up: '受取済',
  cancelled: 'キャンセル',
}

const STATUS_TONE: Record<string, string> = {
  placed: 'bg-sky-100 text-sky-800',
  preparing: 'bg-violet-100 text-violet-800',
  ready: 'bg-emerald-100 text-emerald-800',
  picked_up: 'bg-slate-100 text-slate-700',
  cancelled: 'bg-rose-100 text-rose-700',
}

const NEXT_ACTIONS: Record<string, Array<{ status: string; label: string }>> = {
  placed: [
    { status: 'preparing', label: '調理開始' },
    { status: 'ready', label: '完成にする' },
    { status: 'cancelled', label: 'キャンセル' },
  ],
  preparing: [
    { status: 'ready', label: '完成にする' },
    { status: 'cancelled', label: 'キャンセル' },
  ],
  ready: [{ status: 'picked_up', label: '受け渡し完了' }],
  picked_up: [],
  cancelled: [],
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatPrice(value: number) {
  return `${value.toLocaleString()} 円`
}

function getNotificationTypeLabel(type: MobileOrderNotificationRow['notification_type']) {
  if (type === 'order_completed') return '注文完了通知'
  if (type === 'order_preparing') return '調理開始通知'
  return '完成通知'
}

function getNotificationStatusLabel(notification: MobileOrderNotificationRow) {
  if (notification.sent_at) return '送信済み'
  if (notification.failed_at) return '送信失敗'
  return '送信待ち'
}

function getNotificationStatusTone(notification: MobileOrderNotificationRow) {
  if (notification.sent_at) return 'bg-emerald-50 text-emerald-700'
  if (notification.failed_at) return 'bg-rose-100 text-rose-700'
  return 'bg-amber-100 text-amber-800'
}

function maskLineUserId(value: string | null | undefined) {
  const userId = String(value ?? '').trim()
  if (!userId) return '未保存'
  if (userId.length <= 8) return userId
  return `${userId.slice(0, 4)}...${userId.slice(-4)}`
}

export default function VendorMobileOrderOrdersPage() {
  const [data, setData] = useState<VendorMobileOrderOrdersPayload | null>(null)
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [pendingStatus, setPendingStatus] = useState<string | null>(null)
  const [pendingNotificationId, setPendingNotificationId] = useState<string | null>(null)
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [notificationBanner, setNotificationBanner] = useState<string | null>(null)
  const knownOrderIdsRef = useRef<string[]>([])
  const knownScheduleIdRef = useRef<string | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const notificationBannerTimeoutRef = useRef<number | null>(null)

  function clearNotificationBannerLater() {
    if (notificationBannerTimeoutRef.current != null) {
      window.clearTimeout(notificationBannerTimeoutRef.current)
    }

    notificationBannerTimeoutRef.current = window.setTimeout(() => {
      setNotificationBanner(null)
    }, 7000)
  }

  function playNotificationSound() {
    if (typeof window === 'undefined') return

    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioContextCtor) return

    const audioContext = audioContextRef.current ?? new AudioContextCtor()
    audioContextRef.current = audioContext

    if (audioContext.state === 'suspended') {
      void audioContext.resume()
    }

    const oscillator = audioContext.createOscillator()
    const gainNode = audioContext.createGain()
    const now = audioContext.currentTime

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(880, now)
    oscillator.frequency.setValueAtTime(1174, now + 0.12)

    gainNode.gain.setValueAtTime(0.0001, now)
    gainNode.gain.exponentialRampToValueAtTime(0.14, now + 0.02)
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.34)

    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    oscillator.start(now)
    oscillator.stop(now + 0.36)
  }

  function speakNotification(messageToSpeak: string) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(messageToSpeak)
    utterance.lang = 'ja-JP'
    utterance.rate = 1
    utterance.pitch = 1
    window.speechSynthesis.speak(utterance)
  }

  function announceNewOrders(newOrders: VendorMobileOrderDashboardOrder[]) {
    if (newOrders.length === 0) return

    const newestOrder = [...newOrders].sort(
      (a, b) => new Date(b.ordered_at).getTime() - new Date(a.ordered_at).getTime()
    )[0]
    const bannerMessage =
      newOrders.length === 1
        ? `新しい注文 ${newestOrder.order_number} を受け付けました`
        : `新しい注文を ${newOrders.length} 件 受け付けました`

    setNotificationBanner(bannerMessage)
    clearNotificationBannerLater()
    playNotificationSound()
    speakNotification('注文を受け付けました')
  }

  async function enableNotifications() {
    try {
      playNotificationSound()
      speakNotification('通知を有効にしました')
      window.localStorage.setItem(NOTIFICATION_STORAGE_KEY, 'true')
      setNotificationsEnabled(true)
      setNotificationBanner('新着注文の音声通知を有効にしました')
      clearNotificationBannerLater()
    } catch {
      setError('通知の有効化に失敗しました')
    }
  }

  async function load(scheduleId?: string | null) {
    try {
      const search = scheduleId ? `?schedule_id=${encodeURIComponent(scheduleId)}` : ''
      const response = await fetchApi<VendorMobileOrderOrdersPayload>(`/api/vendor/mobile-order/orders${search}`, {
        cache: 'no-store',
      })

      const responseScheduleId = response.selectedSchedule?.id ?? null
      const nextOrderIds = response.orders.map((order) => order.id)
      const isSameSchedule = knownScheduleIdRef.current === responseScheduleId

      if (isSameSchedule && notificationsEnabled && knownOrderIdsRef.current.length > 0) {
        const newOrders = response.orders.filter((order) => !knownOrderIdsRef.current.includes(order.id))
        if (newOrders.length > 0) {
          announceNewOrders(newOrders)
        }
      }

      knownScheduleIdRef.current = responseScheduleId
      knownOrderIdsRef.current = nextOrderIds
      setData(response)
      setSelectedScheduleId(responseScheduleId)

      setSelectedOrderId((current) => {
        if (current && response.orders.some((order) => order.id === current)) {
          return current
        }
        return response.orders[0]?.id ?? null
      })
      setError(null)
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : '注文一覧の取得に失敗しました')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    const saved = window.localStorage.getItem(NOTIFICATION_STORAGE_KEY)
    setNotificationsEnabled(saved === 'true')
  }, [])

  useEffect(() => {
    if (!selectedScheduleId) return

    const intervalId = window.setInterval(() => {
      void load(selectedScheduleId)
    }, 5000)

    return () => window.clearInterval(intervalId)
  }, [selectedScheduleId])

  useEffect(() => {
    return () => {
      if (notificationBannerTimeoutRef.current != null) {
        window.clearTimeout(notificationBannerTimeoutRef.current)
      }
    }
  }, [])

  const selectedOrder = useMemo(
    () => data?.orders.find((order) => order.id === selectedOrderId) ?? null,
    [data, selectedOrderId]
  )

  const counts = useMemo(() => {
    const source = data?.orders ?? []
    return {
      placed: source.filter((order) => order.status === 'placed').length,
      preparing: source.filter((order) => order.status === 'preparing').length,
      ready: source.filter((order) => order.status === 'ready').length,
      picked_up: source.filter((order) => order.status === 'picked_up').length,
    }
  }, [data?.orders])

  async function handleChangeSchedule(scheduleId: string) {
    setLoading(true)
    await load(scheduleId)
  }

  async function handleChangeStatus(order: VendorMobileOrderDashboardOrder, nextStatus: string) {
    setPendingStatus(nextStatus)
    setMessage(null)

    try {
      await fetchApi<VendorMobileOrderOrderMutationPayload>(`/api/vendor/mobile-order/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      setMessage(`注文 ${order.order_number} を「${STATUS_LABELS[nextStatus]}」に更新しました`)
      await load(selectedScheduleId)
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : '注文ステータスの更新に失敗しました')
    } finally {
      setPendingStatus(null)
    }
  }

  async function handleSendNotification(orderId: string, notification: MobileOrderNotificationRow) {
    setPendingNotificationId(notification.id)
    setMessage(null)

    try {
      const updatedNotification = await fetchApi<MobileOrderNotificationRow>(
        `/api/vendor/mobile-order/orders/${orderId}/notifications/${notification.id}/send`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }
      )

      setMessage(
        `${getNotificationTypeLabel(notification.notification_type)}を処理しました（結果: ${updatedNotification.delivery_status}）`
      )
      await load(selectedScheduleId)
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : '通知送信に失敗しました')
    } finally {
      setPendingNotificationId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="badge-blue badge-soft inline-block mb-3">注文ダッシュボード</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">モバイルオーダーの受注をさばく</h1>
          <p className="text-sm text-gray-500">
            注文番号、ニックネーム、内容、受注時刻を見ながら、調理から受け渡しまでの状態を更新できます。
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <button
            type="button"
            onClick={() => void enableNotifications()}
            className={`rounded-full px-4 py-2 font-medium transition ${
              notificationsEnabled
                ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                : 'bg-white text-[var(--accent-blue)] ring-1 ring-[var(--accent-blue-soft)] hover:bg-[var(--accent-blue-soft)]'
            }`}
          >
            {notificationsEnabled ? '通知有効化済み' : '通知を有効化'}
          </button>
          <Link
            href="/vendor/mobile-order"
            className="rounded-full bg-slate-100 px-4 py-2 font-medium text-slate-700 transition hover:bg-slate-200"
          >
            モバイル注文トップへ戻る
          </Link>
          <Link
            href="/vendor/mobile-order/products"
            className="rounded-full bg-white px-4 py-2 font-medium text-[var(--accent-blue)] ring-1 ring-[var(--accent-blue-soft)] transition hover:bg-[var(--accent-blue-soft)]"
          >
            商品管理へ
          </Link>
        </div>
      </div>

      {error && <p className="alert-danger px-4 py-3 text-sm text-red-700">{error}</p>}
      {message && <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{message}</p>}
      {notificationBanner && (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          {notificationBanner}
        </p>
      )}

      {loading ? (
        <div className="soft-panel p-6 text-sm text-gray-500">読み込み中...</div>
      ) : data ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <section className="soft-panel p-5 xl:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">対象営業枠</p>
              <h2 className="mt-2 text-lg font-semibold text-gray-800">
                {data.selectedSchedule
                  ? `${formatDateTime(data.selectedSchedule.opens_at)} - ${formatDateTime(data.selectedSchedule.closes_at)}`
                  : '営業枠未選択'}
              </h2>
              <p className="mt-2 text-sm text-gray-500">
                {data.selectedSchedule
                  ? `営業日 ${data.selectedSchedule.business_date} / ${data.store.store_name}`
                  : 'まず営業スケジュールを追加してください'}
              </p>
            </section>
            <section className="soft-panel p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">受付済</p>
              <p className="mt-2 text-2xl font-bold text-sky-700">{counts.placed}</p>
            </section>
            <section className="soft-panel p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">調理中</p>
              <p className="mt-2 text-2xl font-bold text-violet-700">{counts.preparing}</p>
            </section>
            <section className="soft-panel p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">完成</p>
              <p className="mt-2 text-2xl font-bold text-emerald-700">{counts.ready}</p>
            </section>
            <section className="soft-panel p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">受取済</p>
              <p className="mt-2 text-2xl font-bold text-slate-700">{counts.picked_up}</p>
            </section>
          </div>

          <section className="soft-panel p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">営業枠を切り替える</h2>
                <p className="mt-1 text-sm text-gray-500">当日の営業枠だけでなく、過去の営業枠の注文も見返せます。</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {data.schedules.length === 0 ? (
                <p className="text-sm text-gray-500">営業枠がまだありません。</p>
              ) : (
                data.schedules.map((schedule) => (
                  <button
                    key={schedule.id}
                    type="button"
                    onClick={() => void handleChangeSchedule(schedule.id)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      schedule.id === data.selectedSchedule?.id
                        ? 'bg-[var(--accent-blue)] text-white'
                        : 'bg-white text-slate-700 ring-1 ring-[var(--line-soft)] hover:bg-slate-50'
                    }`}
                  >
                    {formatDateTime(schedule.opens_at)}
                  </button>
                ))
              )}
            </div>
          </section>

          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <section className="soft-panel p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">注文一覧</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    {data.selectedSchedule ? `${data.orders.length} 件の注文` : '営業枠を選択してください'}
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {data.orders.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-[var(--line-soft)] bg-white px-5 py-6 text-sm text-gray-500">
                    この営業枠の注文はまだありません。
                  </div>
                ) : (
                  data.orders.map((order) => (
                    <button
                      key={order.id}
                      type="button"
                      onClick={() => setSelectedOrderId(order.id)}
                      className={`w-full rounded-3xl border px-5 py-4 text-left transition ${
                        selectedOrderId === order.id
                          ? 'border-[var(--accent-blue)] bg-[var(--accent-blue-soft)]'
                          : 'border-[var(--line-soft)] bg-white hover:border-[var(--accent-blue-soft)]'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-lg font-bold text-[var(--accent-blue)]">{order.order_number}</p>
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_TONE[order.status]}`}>
                              {STATUS_LABELS[order.status]}
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-medium text-gray-800">{order.pickup_nickname}</p>
                          <p className="mt-1 text-xs text-gray-500">{formatDateTime(order.ordered_at)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-gray-800">{formatPrice(order.total_amount)}</p>
                          <p className="mt-1 text-xs text-gray-500">{order.mobile_order_items.length} 品目</p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </section>

            <section className="soft-panel p-6">
              {selectedOrder ? (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-2xl font-bold text-[var(--accent-blue)]">{selectedOrder.order_number}</h2>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_TONE[selectedOrder.status]}`}>
                          {STATUS_LABELS[selectedOrder.status]}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-gray-700">受け取り名: {selectedOrder.pickup_nickname}</p>
                      <p className="mt-1 text-sm text-gray-500">注文時刻: {formatDateTime(selectedOrder.ordered_at)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">合計</p>
                      <p className="text-xl font-bold text-gray-800">{formatPrice(selectedOrder.total_amount)}</p>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-[var(--line-soft)] bg-white p-5">
                    <h3 className="text-base font-semibold text-gray-800">注文内容</h3>
                    <div className="mt-4 space-y-4">
                      {selectedOrder.mobile_order_items.map((item) => (
                        <div key={item.id} className="rounded-2xl border border-[var(--line-soft)] bg-[#fafafa] px-4 py-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-gray-800">
                                {item.product_name_snapshot} x {item.quantity}
                              </p>
                              {item.mobile_order_item_option_choices.length > 0 ? (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {item.mobile_order_item_option_choices.map((choice) => (
                                    <span
                                      key={choice.id}
                                      className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-[var(--line-soft)]"
                                    >
                                      {choice.option_group_name_snapshot}: {choice.option_choice_name_snapshot}
                                      {choice.price_delta_snapshot > 0 ? ` (+${choice.price_delta_snapshot}円)` : ''}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <p className="mt-2 text-xs text-gray-500">オプションなし</p>
                              )}
                            </div>
                            <p className="text-sm font-semibold text-gray-800">{formatPrice(item.line_total_amount)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-[var(--line-soft)] bg-white p-5">
                    <h3 className="text-base font-semibold text-gray-800">ステータスを進める</h3>
                    <div className="mt-4 flex flex-wrap gap-3">
                      {(NEXT_ACTIONS[selectedOrder.status] ?? []).length === 0 ? (
                        <p className="text-sm text-gray-500">この注文はこれ以上ステータスを進められません。</p>
                      ) : (
                        NEXT_ACTIONS[selectedOrder.status].map((action) => (
                          <button
                            key={action.status}
                            type="button"
                            disabled={pendingStatus != null}
                            onClick={() => void handleChangeStatus(selectedOrder, action.status)}
                            className="rounded-full bg-[var(--accent-blue)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                          >
                            {pendingStatus === action.status ? '更新中...' : action.label}
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-3xl border border-[var(--line-soft)] bg-white p-5">
                    <h3 className="text-base font-semibold text-gray-800">通知状況</h3>
                    <p className="mt-2 text-sm text-gray-500">
                      送信待ちの通知は、ここから手動でLINE送信できます。LIFF連携前は userId 未取得のため失敗理由もここに残ります。
                    </p>
                    <div className="mt-4 rounded-2xl border border-[var(--line-soft)] bg-[#fafafa] px-4 py-4 text-xs text-gray-600">
                      <p>
                        customer_line_user_id: <span className="font-semibold text-gray-800">{maskLineUserId(selectedOrder.customer_line_user_id)}</span>
                      </p>
                      <p className="mt-1">
                        LINE表示名: <span className="font-semibold text-gray-800">{selectedOrder.customer_line_display_name || '未保存'}</span>
                      </p>
                    </div>
                    <div className="mt-4 space-y-3">
                      {selectedOrder.mobile_order_notifications.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-[var(--line-soft)] bg-[#fafafa] px-4 py-4 text-sm text-gray-500">
                          まだ通知履歴はありません。
                        </div>
                      ) : (
                        selectedOrder.mobile_order_notifications
                          .slice()
                          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                          .map((notification) => (
                            <div
                              key={notification.id}
                              className="rounded-2xl border border-[var(--line-soft)] bg-[#fafafa] px-4 py-4"
                            >
                              <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-semibold text-gray-800">
                                      {getNotificationTypeLabel(notification.notification_type)}
                                    </p>
                                    <span
                                      className={`rounded-full px-3 py-1 text-xs font-semibold ${getNotificationStatusTone(notification)}`}
                                    >
                                      {getNotificationStatusLabel(notification)}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-xs text-gray-500">
                                    作成日時: {formatDateTime(notification.created_at)}
                                  </p>
                                  {notification.error_message && (
                                    <p className="mt-2 text-xs text-gray-500">{notification.error_message}</p>
                                  )}
                                  <div className="mt-2 text-[11px] text-gray-400">
                                    <p>delivery_status: {notification.delivery_status}</p>
                                    <p>line_message_id: {notification.line_message_id || '未設定'}</p>
                                  </div>
                                  {!notification.sent_at && (
                                    <button
                                      type="button"
                                      onClick={() => void handleSendNotification(selectedOrder.id, notification)}
                                      disabled={pendingNotificationId != null}
                                      className="mt-3 rounded-full bg-[var(--accent-blue)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                                    >
                                      {pendingNotificationId === notification.id
                                        ? '送信中...'
                                        : notification.failed_at
                                          ? 'LINE通知を再送する'
                                          : 'LINE通知を送る'}
                                    </button>
                                  )}
                                </div>
                                <div className="text-right text-xs text-gray-500">
                                  {notification.sent_at && <p>送信: {formatDateTime(notification.sent_at)}</p>}
                                  {notification.failed_at && <p>失敗: {formatDateTime(notification.failed_at)}</p>}
                                </div>
                              </div>
                            </div>
                          ))
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-[var(--line-soft)] bg-white px-5 py-10 text-center text-sm text-gray-500">
                  左の注文を選ぶと、内容とステータス操作が表示されます。
                </div>
              )}
            </section>
          </div>
        </>
      ) : null}
    </div>
  )
}
