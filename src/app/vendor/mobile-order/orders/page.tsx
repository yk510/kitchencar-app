'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiClientError, fetchApi } from '@/lib/api-client'
import { VendorMobileOrderDashboardHeader } from '@/components/VendorMobileOrderDashboardHeader'
import { VendorMobileOrderDetailHeader } from '@/components/VendorMobileOrderDetailHeader'
import { VendorMobileOrderFilters } from '@/components/VendorMobileOrderFilters'
import { VendorMobileOrderItemsSection } from '@/components/VendorMobileOrderItemsSection'
import { VendorMobileOrderListCard } from '@/components/VendorMobileOrderListCard'
import { VendorMobileOrderListHeader } from '@/components/VendorMobileOrderListHeader'
import { VendorMobileOrderNotificationsSection } from '@/components/VendorMobileOrderNotificationsSection'
import { VendorMobileOrderScheduleOverview } from '@/components/VendorMobileOrderScheduleOverview'
import { VendorMobileOrderStatusSection } from '@/components/VendorMobileOrderStatusSection'
import { isStorePosOrder, resolveMobileOrderPaymentMethod } from '@/lib/mobile-order-fields'
import {
  getNotificationStatusLabel,
  getNotificationStatusTone,
  getNotificationTypeLabel,
} from '@/lib/vendor-mobile-order-notification-copy'
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
import { useVendorMobileOrderDashboardActions } from '@/lib/use-vendor-mobile-order-dashboard-actions'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { useVendorMobileOrderDashboardData } from '@/lib/use-vendor-mobile-order-dashboard-data'
import type {
  MobileOrderNotificationRow,
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

function maskLineUserId(value: string | null | undefined) {
  const userId = String(value ?? '').trim()
  if (!userId) return '未保存'
  if (userId.length <= 8) return userId
  return `${userId.slice(0, 4)}...${userId.slice(-4)}`
}

export default function VendorMobileOrderOrdersPage() {
  const [message, setMessage] = useState<string | null>(null)
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
  const {
    pendingStatus,
    pendingPaymentReceiptOrderId,
    pendingNotificationId,
    handleChangeStatus,
    handleSendNotification,
    handleReceivePayment,
  } = useVendorMobileOrderDashboardActions({
    orders,
    counts,
    selectedOrder,
    selectedScheduleId,
    dashboardStoreId: dashboard?.store.id ?? null,
    setMessage,
    setError,
    setOrders,
    setCounts,
    setSelectedOrder,
    updateOrderInList,
    updateSelectedOrderDetail,
    refreshSummary,
    refreshList,
    loadSelectedOrder,
  })

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

  return (
    <div className="space-y-5">
      <VendorMobileOrderDashboardHeader
        notificationsEnabled={notificationsEnabled}
        onEnableNotifications={() => {
          void enableNotifications()
        }}
        onBack={handleBackToPreviousPage}
      />

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
          <VendorMobileOrderScheduleOverview
            schedules={dashboard.schedules}
            selectedSchedule={dashboard.selectedSchedule}
            storeName={dashboard.store.store_name}
            counts={counts}
            formatDateTime={formatDateTime}
            onChangeSchedule={(scheduleId) => {
              void handleChangeSchedule(scheduleId)
            }}
          />

          <div className="grid gap-4 lg:grid-cols-[minmax(340px,0.8fr)_minmax(0,1.2fr)]">
            <section className="soft-panel p-4 lg:h-[calc(100vh-20rem)] lg:min-h-[620px] lg:overflow-hidden">
              <VendorMobileOrderListHeader
                visibleCount={filteredOrders.length}
                totalCount={counts.total}
                hasSelectedSchedule={!!dashboard.selectedSchedule}
              />

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
                  <VendorMobileOrderDetailHeader
                    orderNumber={selectedOrder.order_number}
                    statusLabel={STATUS_LABELS[selectedOrder.status]}
                    statusTone={STATUS_TONE[selectedOrder.status]}
                    isStorePos={isStorePosOrder(selectedOrder)}
                    paymentMethodLabel={getStorePosPaymentMethodLabel(selectedOrder)}
                    pickupNickname={selectedOrder.pickup_nickname}
                    orderedAtLabel={formatDateTime(selectedOrder.ordered_at)}
                    paymentStatusLabel={PAYMENT_STATUS_LABELS[selectedOrder.payment_status] ?? selectedOrder.payment_status}
                    totalAmountLabel={formatPrice(selectedOrder.total_amount)}
                  />

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
