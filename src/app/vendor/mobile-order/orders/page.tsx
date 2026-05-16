'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiClientError, fetchApi } from '@/lib/api-client'
import { VendorMobileOrderFilters } from '@/components/VendorMobileOrderFilters'
import { VendorMobileOrderItemsSection } from '@/components/VendorMobileOrderItemsSection'
import { VendorMobileOrderListCard } from '@/components/VendorMobileOrderListCard'
import { VendorMobileOrderNotificationsSection } from '@/components/VendorMobileOrderNotificationsSection'
import { VendorMobileOrderScheduleSwitcher } from '@/components/VendorMobileOrderScheduleSwitcher'
import { VendorMobileOrderStatusSection } from '@/components/VendorMobileOrderStatusSection'
import { isStorePosOrder, resolveMobileOrderPaymentMethod } from '@/lib/mobile-order-fields'
import {
  createFilterDefinitions,
  filterAndSortOrders,
  NEXT_ACTIONS,
  OrderListFilter,
  PAYMENT_STATUS_LABELS,
  STATUS_LABELS,
  STATUS_TONE,
} from '@/lib/vendor-mobile-order-order-list'
import { useOrderDashboardNotifications } from '@/lib/use-order-dashboard-notifications'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { useVendorMobileOrderDashboardData } from '@/lib/use-vendor-mobile-order-dashboard-data'
import type {
  MobileOrderNotificationRow,
  VendorMobileOrderDashboardOrder,
  VendorMobileOrderListItem,
  VendorMobileOrderOrderMutationPayload,
  VendorMobileOrderOrdersListPayload,
  VendorMobileOrderOrdersSummaryPayload,
} from '@/types/api-payloads'

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

export default function VendorMobileOrderOrdersPage() {
  const [message, setMessage] = useState<string | null>(null)
  const [pendingStatus, setPendingStatus] = useState<string | null>(null)
  const [pendingPaymentReceiptOrderId, setPendingPaymentReceiptOrderId] = useState<string | null>(null)
  const [pendingNotificationId, setPendingNotificationId] = useState<string | null>(null)
  const [orderListFilter, setOrderListFilter] = useState<OrderListFilter>('action_required')
  const {
    notificationsEnabled,
    notificationBanner,
    newOrderIds,
    clearNewOrderHighlight,
    enableNotifications,
    processIncomingOrders,
    resetForScheduleChange,
  } = useOrderDashboardNotifications()
  const {
    dashboard,
    orders,
    counts,
    selectedOrder,
    selectedScheduleId,
    selectedOrderId,
    loading,
    detailLoading,
    error,
    setError,
    setOrders,
    setCounts,
    setSelectedOrder,
    setSelectedOrderId,
    loadSelectedOrder,
    refreshSummary,
    refreshList,
    syncIncomingOrders,
    shouldRefreshSelectedOrderDetail,
    loadDashboard,
    changeSchedule,
    updateOrderInList,
    updateSelectedOrderDetail,
  } = useVendorMobileOrderDashboardData({ processIncomingOrders })

  function handleBackToPreviousPage() {
    if (typeof window === 'undefined') return
    if (window.history.length > 1) {
      window.history.back()
      return
    }
    window.location.href = '/vendor/mobile-order'
  }

  useEffect(() => {
    void loadDashboard()
  }, [])

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

  const filteredOrders = useMemo(() => filterAndSortOrders(orders, orderListFilter), [orders, orderListFilter])
  const filterDefinitions = useMemo(() => createFilterDefinitions(orders, counts), [orders, counts])

  const handleChangeSchedule = useCallback(async (scheduleId: string) => {
    await changeSchedule(scheduleId, resetForScheduleChange)
  }, [changeSchedule, resetForScheduleChange])

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
