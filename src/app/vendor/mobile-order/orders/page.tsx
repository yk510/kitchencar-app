'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ApiClientError, fetchApi } from '@/lib/api-client'
import { VendorMobileOrderFilters } from '@/components/VendorMobileOrderFilters'
import { VendorMobileOrderItemsSection } from '@/components/VendorMobileOrderItemsSection'
import { VendorMobileOrderListCard } from '@/components/VendorMobileOrderListCard'
import { VendorMobileOrderNotificationsSection } from '@/components/VendorMobileOrderNotificationsSection'
import { VendorMobileOrderScheduleSwitcher } from '@/components/VendorMobileOrderScheduleSwitcher'
import { VendorMobileOrderStatusSection } from '@/components/VendorMobileOrderStatusSection'
import { isStorePosOrder, resolveMobileOrderPaymentMethod } from '@/lib/mobile-order-fields'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import type {
  MobileOrderNotificationRow,
  VendorMobileOrderDashboardOrder,
  VendorMobileOrderListItem,
  VendorMobileOrderOrderDetailPayload,
  VendorMobileOrderOrderMutationPayload,
  VendorMobileOrderOrdersListPayload,
  VendorMobileOrderOrdersPayload,
  VendorMobileOrderOrdersSummaryPayload,
} from '@/types/api-payloads'

const NOTIFICATION_STORAGE_KEY = 'mobile-order-dashboard-notifications-enabled'
const NEW_ORDER_HIGHLIGHT_MS = 15000
const LAST_SEEN_ORDER_MARKER_KEY = 'mobile-order-dashboard-last-seen'

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

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: '未受領',
  authorized: '支払済み',
  paid: '受領済み',
  failed: '失敗',
  refunded: '返金済み',
}

type OrderListFilter = 'all' | 'action_required' | 'preparing' | 'ready' | 'picked_up'

type LastSeenOrderMarker = {
  orderedAt: string
}

const EMPTY_COUNTS: VendorMobileOrderOrdersSummaryPayload = {
  placed: 0,
  preparing: 0,
  ready: 0,
  picked_up: 0,
  total: 0,
}

function buildCountsFromOrders(source: VendorMobileOrderListItem[]): VendorMobileOrderOrdersSummaryPayload {
  return {
    placed: source.filter((order) => order.status === 'placed').length,
    preparing: source.filter((order) => order.status === 'preparing').length,
    ready: source.filter((order) => order.status === 'ready').length,
    picked_up: source.filter((order) => order.status === 'picked_up').length,
    total: source.length,
  }
}

function getStorePosPaymentMethodLabel(order: {
  payment_provider?: string | null
  payment_method?: string | null
}) {
  const method = resolveMobileOrderPaymentMethod(order)
  if (method === 'cash') return '現金'
  if (method === 'paypay') return 'PayPay'
  if (method === 'other') return 'その他'
  return '店頭POS'
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

function getLastSeenMarkerStorageKey(storeId: string, scheduleId: string | null) {
  return `${LAST_SEEN_ORDER_MARKER_KEY}:${storeId}:${scheduleId ?? 'none'}`
}

function readLastSeenMarker(storeId: string, scheduleId: string | null): LastSeenOrderMarker | null {
  if (typeof window === 'undefined') return null

  const raw = window.localStorage.getItem(getLastSeenMarkerStorageKey(storeId, scheduleId))
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<LastSeenOrderMarker>
    if (typeof parsed.orderedAt !== 'string' || !parsed.orderedAt) return null
    return { orderedAt: parsed.orderedAt }
  } catch {
    return null
  }
}

function writeLastSeenMarker(
  storeId: string,
  scheduleId: string | null,
  marker: LastSeenOrderMarker | null
) {
  if (typeof window === 'undefined') return

  const key = getLastSeenMarkerStorageKey(storeId, scheduleId)
  if (!marker) {
    window.localStorage.removeItem(key)
    return
  }

  window.localStorage.setItem(key, JSON.stringify(marker))
}

export default function VendorMobileOrderOrdersPage() {
  const [dashboard, setDashboard] = useState<VendorMobileOrderOrdersPayload | null>(null)
  const [orders, setOrders] = useState<VendorMobileOrderListItem[]>([])
  const [counts, setCounts] = useState<VendorMobileOrderOrdersSummaryPayload>(EMPTY_COUNTS)
  const [selectedOrder, setSelectedOrder] = useState<VendorMobileOrderDashboardOrder | null>(null)
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [pendingStatus, setPendingStatus] = useState<string | null>(null)
  const [pendingPaymentReceiptOrderId, setPendingPaymentReceiptOrderId] = useState<string | null>(null)
  const [pendingNotificationId, setPendingNotificationId] = useState<string | null>(null)
  const [notificationsEnabled, setNotificationsEnabled] = useState(false)
  const [notificationBanner, setNotificationBanner] = useState<string | null>(null)
  const [orderListFilter, setOrderListFilter] = useState<OrderListFilter>('action_required')
  const [newOrderIds, setNewOrderIds] = useState<string[]>([])
  const knownOrderIdsRef = useRef<string[]>([])
  const knownScheduleIdRef = useRef<string | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const notificationBannerTimeoutRef = useRef<number | null>(null)
  const newOrderTimeoutsRef = useRef<Record<string, number>>({})

  function updateOrderInList(
    orderId: string,
    updater: (order: VendorMobileOrderListItem) => VendorMobileOrderListItem
  ) {
    setOrders((current) => {
      const next = current.map((order) => (order.id === orderId ? updater(order) : order))
      setCounts(buildCountsFromOrders(next))
      return next
    })
  }

  function updateSelectedOrderDetail(
    orderId: string,
    updater: (order: VendorMobileOrderDashboardOrder) => VendorMobileOrderDashboardOrder
  ) {
    setSelectedOrder((current) => {
      if (!current || current.id !== orderId) return current
      return updater(current)
    })
  }

  function handleBackToPreviousPage() {
    if (typeof window === 'undefined') return
    if (window.history.length > 1) {
      window.history.back()
      return
    }
    window.location.href = '/vendor/mobile-order'
  }

  function clearNotificationBannerLater() {
    if (notificationBannerTimeoutRef.current != null) {
      window.clearTimeout(notificationBannerTimeoutRef.current)
    }

    notificationBannerTimeoutRef.current = window.setTimeout(() => {
      setNotificationBanner(null)
    }, 7000)
  }

  function isUnhandledOrder(order: { status: string }) {
    return order.status !== 'picked_up' && order.status !== 'cancelled'
  }

  function clearNewOrderHighlight(orderId: string) {
    setNewOrderIds((current) => current.filter((id) => id !== orderId))
    const timeoutId = newOrderTimeoutsRef.current[orderId]
    if (timeoutId != null) {
      window.clearTimeout(timeoutId)
      delete newOrderTimeoutsRef.current[orderId]
    }
  }

  function highlightNewOrders(orderIds: string[]) {
    if (orderIds.length === 0 || typeof window === 'undefined') return

    setNewOrderIds((current) => Array.from(new Set([...current, ...orderIds])))

    for (const orderId of orderIds) {
      const existingTimeout = newOrderTimeoutsRef.current[orderId]
      if (existingTimeout != null) {
        window.clearTimeout(existingTimeout)
      }

      newOrderTimeoutsRef.current[orderId] = window.setTimeout(() => {
        clearNewOrderHighlight(orderId)
      }, NEW_ORDER_HIGHLIGHT_MS)
    }
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

  function primeNotificationAudio() {
    if (typeof window === 'undefined') return

    const AudioContextCtor =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

    if (AudioContextCtor) {
      const audioContext = audioContextRef.current ?? new AudioContextCtor()
      audioContextRef.current = audioContext

      if (audioContext.state === 'suspended') {
        void audioContext.resume().catch(() => undefined)
      }
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices()
    }
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

  function announceNewOrders(newOrders: Array<Pick<VendorMobileOrderListItem, 'id' | 'ordered_at' | 'order_number'>>) {
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
      primeNotificationAudio()
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

  function syncIncomingOrders(
    storeId: string,
    responseScheduleId: string | null,
    incomingOrders: VendorMobileOrderListItem[]
  ) {
    const nextOrderIds = incomingOrders.map((order) => order.id)
    const isSameSchedule = knownScheduleIdRef.current === responseScheduleId
    const lastSeenMarker = readLastSeenMarker(storeId, responseScheduleId)
    const latestOrder = incomingOrders
      .slice()
      .sort((a, b) => new Date(b.ordered_at).getTime() - new Date(a.ordered_at).getTime())[0]

    const ordersSinceLastSeen =
      notificationsEnabled && lastSeenMarker
        ? incomingOrders.filter(
            (order) => new Date(order.ordered_at).getTime() > new Date(lastSeenMarker.orderedAt).getTime()
          )
        : []

    if (notificationsEnabled) {
      if (ordersSinceLastSeen.length > 0) {
        announceNewOrders(ordersSinceLastSeen)
        highlightNewOrders(ordersSinceLastSeen.map((order) => order.id))
      } else if (isSameSchedule && knownOrderIdsRef.current.length > 0) {
        const newOrders = incomingOrders.filter((order) => !knownOrderIdsRef.current.includes(order.id))
        if (newOrders.length > 0) {
          announceNewOrders(newOrders)
          highlightNewOrders(newOrders.map((order) => order.id))
        }
      }
    }

    knownScheduleIdRef.current = responseScheduleId
    knownOrderIdsRef.current = nextOrderIds
    writeLastSeenMarker(
      storeId,
      responseScheduleId,
      latestOrder ? { orderedAt: latestOrder.ordered_at } : null
    )
    setOrders(incomingOrders)
    setSelectedOrderId((current) => {
      if (current && incomingOrders.some((order) => order.id === current)) {
        return current
      }
      return incomingOrders[0]?.id ?? null
    })
  }

  async function loadSelectedOrder(orderId: string | null) {
    if (!orderId) {
      setSelectedOrder(null)
      return
    }

    setDetailLoading(true)
    try {
      const response = await fetchApi<VendorMobileOrderOrderDetailPayload>(
        `/api/vendor/mobile-order/orders/${orderId}`,
        {
          cache: 'no-store',
        }
      )
      setSelectedOrder(response.order)
      setError(null)
    } catch (err) {
      setSelectedOrder(null)
      setError(err instanceof ApiClientError ? err.message : '注文詳細の取得に失敗しました')
    } finally {
      setDetailLoading(false)
    }
  }

  async function refreshSummary(scheduleId: string | null) {
    const search = scheduleId ? `?schedule_id=${encodeURIComponent(scheduleId)}` : ''
    const response = await fetchApi<VendorMobileOrderOrdersSummaryPayload>(
      `/api/vendor/mobile-order/orders/summary${search}`,
      {
        cache: 'no-store',
      }
    )
    setCounts(response)
  }

  async function refreshList(scheduleId: string | null, storeId: string, responseScheduleId: string | null) {
    const search = scheduleId ? `?schedule_id=${encodeURIComponent(scheduleId)}` : ''
    const response = await fetchApi<VendorMobileOrderOrdersListPayload>(
      `/api/vendor/mobile-order/orders/list${search}`,
      {
        cache: 'no-store',
      }
    )
    syncIncomingOrders(storeId, responseScheduleId, response.orders)
  }

  function shouldRefreshSelectedOrderDetail(nextOrders: VendorMobileOrderListItem[]) {
    if (!selectedOrderId || !selectedOrder) return false

    const selectedListOrder = nextOrders.find((order) => order.id === selectedOrderId)
    if (!selectedListOrder) return true

    return (
      selectedListOrder.status !== selectedOrder.status ||
      selectedListOrder.payment_status !== selectedOrder.payment_status ||
      selectedListOrder.updated_at !== selectedOrder.updated_at ||
      selectedListOrder.total_amount !== selectedOrder.total_amount
    )
  }

  async function loadDashboard(scheduleId?: string | null) {
    try {
      const search = scheduleId ? `?schedule_id=${encodeURIComponent(scheduleId)}` : ''
      const response = await fetchApi<VendorMobileOrderOrdersPayload>(`/api/vendor/mobile-order/orders${search}`, {
        cache: 'no-store',
      })

      const responseScheduleId = response.selectedSchedule?.id ?? null
      setDashboard(response)
      setCounts(response.counts)
      setSelectedScheduleId(responseScheduleId)
      syncIncomingOrders(response.store.id, responseScheduleId, response.orders)
      setError(null)
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : '注文一覧の取得に失敗しました')
      setDashboard(null)
      setOrders([])
      setCounts(EMPTY_COUNTS)
      setSelectedOrder(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadDashboard()
  }, [])

  useEffect(() => {
    const saved = window.localStorage.getItem(NOTIFICATION_STORAGE_KEY)
    setNotificationsEnabled(saved === 'true')
  }, [])

  useEffect(() => {
    if (!notificationsEnabled) return

    primeNotificationAudio()

    const rearmAudio = () => {
      primeNotificationAudio()
    }

    window.addEventListener('pointerdown', rearmAudio, { passive: true })
    window.addEventListener('touchstart', rearmAudio, { passive: true })
    window.addEventListener('keydown', rearmAudio)
    window.addEventListener('focus', rearmAudio)

    return () => {
      window.removeEventListener('pointerdown', rearmAudio)
      window.removeEventListener('touchstart', rearmAudio)
      window.removeEventListener('keydown', rearmAudio)
      window.removeEventListener('focus', rearmAudio)
    }
  }, [notificationsEnabled])

  useLiveRefresh({
    enabled: !!selectedScheduleId && !!dashboard,
    intervalMs: 5000,
    run: async () => {
      if (!dashboard) return

      const search = selectedScheduleId ? `?schedule_id=${encodeURIComponent(selectedScheduleId)}` : ''
      const [summaryResponse, listResponse] = await Promise.all([
        fetchApi<VendorMobileOrderOrdersSummaryPayload>(
          `/api/vendor/mobile-order/orders/summary${search}`,
          { cache: 'no-store' }
        ),
        fetchApi<VendorMobileOrderOrdersListPayload>(
          `/api/vendor/mobile-order/orders/list${search}`,
          { cache: 'no-store' }
        ),
      ])

      setCounts(summaryResponse)
      syncIncomingOrders(dashboard.store.id, selectedScheduleId, listResponse.orders)

      if (shouldRefreshSelectedOrderDetail(listResponse.orders)) {
        await loadSelectedOrder(selectedOrderId)
      }
    },
  })

  useEffect(() => {
    void loadSelectedOrder(selectedOrderId)
  }, [selectedOrderId])

  useEffect(() => {
    return () => {
      if (notificationBannerTimeoutRef.current != null) {
        window.clearTimeout(notificationBannerTimeoutRef.current)
      }

      for (const timeoutId of Object.values(newOrderTimeoutsRef.current)) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [])

  const filteredOrders = useMemo(() => {
    const matchesFilter = (order: VendorMobileOrderListItem) => {
      if (orderListFilter === 'all') return true
      if (orderListFilter === 'action_required') return isUnhandledOrder(order)
      return order.status === orderListFilter
    }

    const priority = (order: VendorMobileOrderListItem) => {
      if (!isUnhandledOrder(order)) return 1
      if (order.status === 'placed') return 0
      if (order.status === 'preparing') return 0
      if (order.status === 'ready') return 0
      return 0
    }

    return orders
      .filter(matchesFilter)
      .slice()
      .sort((a, b) => {
        const priorityDiff = priority(a) - priority(b)
        if (priorityDiff !== 0) return priorityDiff
        return new Date(b.ordered_at).getTime() - new Date(a.ordered_at).getTime()
      })
  }, [orders, orderListFilter])

  const filterDefinitions = useMemo(
    () =>
      [
        { key: 'action_required', label: '未対応', count: orders.filter((order) => isUnhandledOrder(order)).length },
        { key: 'preparing', label: '調理中', count: counts.preparing },
        { key: 'ready', label: '完成', count: counts.ready },
        { key: 'picked_up', label: '受取済', count: counts.picked_up },
        { key: 'all', label: 'すべて', count: counts.total },
      ] as Array<{ key: OrderListFilter; label: string; count: number }>,
    [counts.preparing, counts.ready, counts.picked_up, counts.total, orders]
  )

  const handleChangeSchedule = useCallback(async (scheduleId: string) => {
    setLoading(true)
    setNewOrderIds([])
    for (const timeoutId of Object.values(newOrderTimeoutsRef.current)) {
      window.clearTimeout(timeoutId)
    }
    newOrderTimeoutsRef.current = {}
    await loadDashboard(scheduleId)
  }, [])

  const handleChangeStatus = useCallback(async (orderId: string, orderNumber: string, nextStatus: string) => {
    setPendingStatus(nextStatus)
    setMessage(null)
    const previousOrders = orders
    const previousCounts = counts
    const previousSelectedOrder = selectedOrder

    updateOrderInList(orderId, (current) => ({
      ...current,
      status: nextStatus as VendorMobileOrderListItem['status'],
      updated_at: new Date().toISOString(),
      ...(nextStatus === 'picked_up' ? { picked_up_at: new Date().toISOString() } : {}),
      ...(nextStatus === 'cancelled' ? { cancelled_at: new Date().toISOString() } : {}),
    }))
    updateSelectedOrderDetail(orderId, (current) => ({
      ...current,
      status: nextStatus as VendorMobileOrderDashboardOrder['status'],
      updated_at: new Date().toISOString(),
      ...(nextStatus === 'picked_up' ? { picked_up_at: new Date().toISOString() } : {}),
      ...(nextStatus === 'cancelled' ? { cancelled_at: new Date().toISOString() } : {}),
    }))

    try {
      await fetchApi<VendorMobileOrderOrderMutationPayload>(`/api/vendor/mobile-order/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      setMessage(`注文 ${orderNumber} を「${STATUS_LABELS[nextStatus]}」に更新しました`)
      if (dashboard) {
        void Promise.all([
          refreshSummary(selectedScheduleId),
          refreshList(selectedScheduleId, dashboard.store.id, selectedScheduleId),
          loadSelectedOrder(orderId),
        ])
      }
    } catch (err) {
      setOrders(previousOrders)
      setCounts(previousCounts)
      setSelectedOrder(previousSelectedOrder)
      setError(err instanceof ApiClientError ? err.message : '注文ステータスの更新に失敗しました')
    } finally {
      setPendingStatus(null)
    }
  }, [counts, dashboard, orders, selectedOrder, selectedScheduleId])

  const handleSendNotification = useCallback(async (orderId: string, notification: MobileOrderNotificationRow) => {
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
      await loadSelectedOrder(orderId)
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : '通知送信に失敗しました')
    } finally {
      setPendingNotificationId(null)
    }
  }, [])

  const handleReceivePayment = useCallback(async (orderId: string, orderNumber: string) => {
    setPendingPaymentReceiptOrderId(orderId)
    setMessage(null)
    const previousOrders = orders
    const previousCounts = counts
    const previousSelectedOrder = selectedOrder
    const optimisticPaidAt = new Date().toISOString()

    updateOrderInList(orderId, (current) => ({
      ...current,
      payment_status: 'paid',
      paid_at: optimisticPaidAt,
      updated_at: optimisticPaidAt,
    }))
    updateSelectedOrderDetail(orderId, (current) => ({
      ...current,
      payment_status: 'paid',
      paid_at: optimisticPaidAt,
      updated_at: optimisticPaidAt,
    }))

    try {
      await fetchApi<VendorMobileOrderOrderMutationPayload>(`/api/vendor/mobile-order/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'receive_payment' }),
      })
      setMessage(`注文 ${orderNumber} の料金受領を記録しました`)
      if (dashboard) {
        void Promise.all([
          refreshSummary(selectedScheduleId),
          refreshList(selectedScheduleId, dashboard.store.id, selectedScheduleId),
          loadSelectedOrder(orderId),
        ])
      }
    } catch (err) {
      setOrders(previousOrders)
      setCounts(previousCounts)
      setSelectedOrder(previousSelectedOrder)
      setError(err instanceof ApiClientError ? err.message : '料金受領の更新に失敗しました')
    } finally {
      setPendingPaymentReceiptOrderId(null)
    }
  }, [counts, dashboard, orders, selectedOrder, selectedScheduleId])

  return (
    <div className="space-y-5">
      <section className="flex justify-end">
        <div className="flex flex-wrap items-center gap-2 rounded-full border border-[var(--line-soft)] bg-white/90 px-2 py-2 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
          <button
            type="button"
            onClick={handleBackToPreviousPage}
            className="inline-flex items-center justify-center rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-[var(--line-soft)] transition hover:bg-slate-50"
          >
            前に戻る
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-[var(--line-soft)] transition hover:bg-slate-50"
          >
            ホームへ
          </Link>
        </div>
      </section>
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
      ) : dashboard ? (
        <>
          <div className="grid gap-3 lg:grid-cols-[minmax(280px,1.5fr)_repeat(4,minmax(0,1fr))]">
            <section className="soft-panel p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">対象営業枠</p>
                  <h2 className="mt-1 text-base font-semibold text-gray-800">
                    {dashboard.selectedSchedule
                      ? `${formatDateTime(dashboard.selectedSchedule.opens_at)} - ${formatDateTime(dashboard.selectedSchedule.closes_at)}`
                      : '営業枠未選択'}
                  </h2>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {counts.total}件
                </span>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                {dashboard.selectedSchedule
                  ? `営業日 ${dashboard.selectedSchedule.business_date} / ${dashboard.store.store_name}`
                  : 'まず営業スケジュールを追加してください'}
              </p>
            </section>
            <section className="soft-panel p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">受付済</p>
              <p className="mt-2 text-2xl font-bold text-sky-700">{counts.placed}</p>
            </section>
            <section className="soft-panel p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">調理中</p>
              <p className="mt-2 text-2xl font-bold text-violet-700">{counts.preparing}</p>
            </section>
            <section className="soft-panel p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">完成</p>
              <p className="mt-2 text-2xl font-bold text-emerald-700">{counts.ready}</p>
            </section>
            <section className="soft-panel p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">受取済</p>
              <p className="mt-2 text-2xl font-bold text-slate-700">{counts.picked_up}</p>
            </section>
          </div>

          <section className="soft-panel p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-gray-800">営業枠を切り替える</h2>
                <p className="mt-1 text-xs text-gray-500">当日や過去の営業枠をすばやく切り替えられます。</p>
              </div>
            </div>
            <VendorMobileOrderScheduleSwitcher
              schedules={dashboard.schedules}
              selectedScheduleId={dashboard.selectedSchedule?.id ?? null}
              labelForSchedule={(schedule) => formatDateTime(schedule.opens_at)}
              onSelect={(scheduleId) => {
                void handleChangeSchedule(scheduleId)
              }}
            />
          </section>

          <div className="grid gap-4 lg:grid-cols-[minmax(340px,0.8fr)_minmax(0,1.2fr)]">
            <section className="soft-panel p-4 lg:h-[calc(100vh-20rem)] lg:min-h-[620px] lg:overflow-hidden">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-gray-800">注文一覧</h2>
                  <p className="mt-1 text-xs text-gray-500">
                    {dashboard.selectedSchedule ? `${filteredOrders.length} / ${counts.total} 件を表示中` : '営業枠を選択してください'}
                  </p>
                </div>
              </div>

              <VendorMobileOrderFilters
                filters={filterDefinitions}
                activeFilter={orderListFilter}
                onChange={setOrderListFilter}
              />

              <div className="mt-4 space-y-3 lg:h-[calc(100%-5.5rem)] lg:overflow-y-auto lg:pr-1">
                {filteredOrders.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-[var(--line-soft)] bg-white px-5 py-6 text-sm text-gray-500">
                    この条件に一致する注文はまだありません。
                  </div>
                ) : (
                  filteredOrders.map((order) => (
                    <VendorMobileOrderListCard
                      key={order.id}
                      order={order}
                      selected={selectedOrderId === order.id}
                      isNew={newOrderIds.includes(order.id)}
                      statusLabel={STATUS_LABELS[order.status]}
                      statusTone={STATUS_TONE[order.status]}
                      paymentStatusLabel={PAYMENT_STATUS_LABELS[order.payment_status] ?? order.payment_status}
                      paymentMethodLabel={getStorePosPaymentMethodLabel(order)}
                      orderedAtLabel={formatDateTime(order.ordered_at)}
                      totalAmountLabel={formatPrice(order.total_amount)}
                      onSelect={(orderId) => {
                        setSelectedOrderId(orderId)
                        clearNewOrderHighlight(orderId)
                      }}
                    />
                  ))
                )}
              </div>
            </section>

            <section className="soft-panel p-4 lg:h-[calc(100vh-20rem)] lg:min-h-[620px] lg:overflow-hidden">
              {selectedOrder ? (
                <div className="space-y-4 lg:h-full lg:overflow-y-auto lg:pr-1">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-2xl font-bold text-[var(--accent-blue)]">{selectedOrder.order_number}</h2>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_TONE[selectedOrder.status]}`}>
                          {STATUS_LABELS[selectedOrder.status]}
                        </span>
                        {isStorePosOrder(selectedOrder) ? (
                          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                            店頭POS / {getStorePosPaymentMethodLabel(selectedOrder)}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm text-gray-700">受け取り名: {selectedOrder.pickup_nickname}</p>
                      <p className="mt-1 text-sm text-gray-500">注文時刻: {formatDateTime(selectedOrder.ordered_at)}</p>
                      <p className="mt-1 text-sm text-gray-500">
                        支払状況: {PAYMENT_STATUS_LABELS[selectedOrder.payment_status] ?? selectedOrder.payment_status}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">合計</p>
                      <p className="text-xl font-bold text-gray-800">{formatPrice(selectedOrder.total_amount)}</p>
                    </div>
                  </div>

                  <VendorMobileOrderItemsSection
                    items={selectedOrder.mobile_order_items}
                    formatPrice={formatPrice}
                  />

                  <VendorMobileOrderStatusSection
                    orderId={selectedOrder.id}
                    orderNumber={selectedOrder.order_number}
                    status={selectedOrder.status}
                    paymentStatus={selectedOrder.payment_status}
                    isStorePos={isStorePosOrder(selectedOrder)}
                    pendingStatus={pendingStatus}
                    pendingPaymentReceiptOrderId={pendingPaymentReceiptOrderId}
                    nextActions={NEXT_ACTIONS[selectedOrder.status] ?? []}
                    onReceivePayment={handleReceivePayment}
                    onChangeStatus={handleChangeStatus}
                  />

                  <VendorMobileOrderNotificationsSection
                    orderId={selectedOrder.id}
                    customerLineUserId={selectedOrder.customer_line_user_id}
                    customerLineDisplayName={selectedOrder.customer_line_display_name}
                    notifications={selectedOrder.mobile_order_notifications}
                    pendingNotificationId={pendingNotificationId}
                    maskLineUserId={maskLineUserId}
                    getNotificationTypeLabel={getNotificationTypeLabel}
                    getNotificationStatusTone={getNotificationStatusTone}
                    getNotificationStatusLabel={getNotificationStatusLabel}
                    formatDateTime={formatDateTime}
                    onSendNotification={handleSendNotification}
                  />
                </div>
              ) : detailLoading ? (
                <div className="flex h-full items-center justify-center rounded-3xl border border-dashed border-[var(--line-soft)] bg-white px-5 py-10 text-center text-sm text-gray-500">
                  注文詳細を読み込み中...
                </div>
              ) : (
                <div className="flex h-full items-center justify-center rounded-3xl border border-dashed border-[var(--line-soft)] bg-white px-5 py-10 text-center text-sm text-gray-500">
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
