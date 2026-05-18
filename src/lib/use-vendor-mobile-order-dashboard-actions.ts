'use client'

import { useCallback, useState } from 'react'
import { ApiClientError, fetchApi } from '@/lib/api-client'
import { getNotificationTypeLabel } from '@/lib/vendor-mobile-order-notification-copy'
import { STATUS_LABELS } from '@/lib/vendor-mobile-order-order-list'
import type {
  MobileOrderNotificationRow,
  VendorMobileOrderPrintResultPayload,
  VendorMobileOrderDashboardOrder,
  VendorMobileOrderListItem,
  VendorMobileOrderOrderMutationPayload,
} from '@/types/api-payloads'

type UseVendorMobileOrderDashboardActionsArgs = {
  orders: VendorMobileOrderListItem[]
  counts: {
    placed: number
    preparing: number
    ready: number
    picked_up: number
    total: number
  }
  selectedOrder: VendorMobileOrderDashboardOrder | null
  selectedScheduleId: string | null
  dashboardStoreId: string | null
  setMessage: (message: string | null) => void
  setError: (message: string | null) => void
  setOrders: (orders: VendorMobileOrderListItem[]) => void
  setCounts: (counts: {
    placed: number
    preparing: number
    ready: number
    picked_up: number
    total: number
  }) => void
  setSelectedOrder: (order: VendorMobileOrderDashboardOrder | null) => void
  updateOrderInList: (
    orderId: string,
    updater: (order: VendorMobileOrderListItem) => VendorMobileOrderListItem
  ) => void
  updateSelectedOrderDetail: (
    orderId: string,
    updater: (order: VendorMobileOrderDashboardOrder) => VendorMobileOrderDashboardOrder
  ) => void
  refreshSummary: (scheduleId: string | null) => Promise<void>
  refreshList: (
    scheduleId: string | null,
    storeId: string,
    responseScheduleId: string | null
  ) => Promise<void>
  loadSelectedOrder: (orderId: string | null) => Promise<void>
}

export function useVendorMobileOrderDashboardActions({
  orders,
  counts,
  selectedOrder,
  selectedScheduleId,
  dashboardStoreId,
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
}: UseVendorMobileOrderDashboardActionsArgs) {
  const [pendingStatus, setPendingStatus] = useState<string | null>(null)
  const [pendingPaymentReceiptOrderId, setPendingPaymentReceiptOrderId] = useState<string | null>(null)
  const [pendingNotificationId, setPendingNotificationId] = useState<string | null>(null)
  const [pendingReprintOrderId, setPendingReprintOrderId] = useState<string | null>(null)

  const refreshOrderSurface = useCallback(
    async (orderId: string) => {
      if (!dashboardStoreId) {
        await loadSelectedOrder(orderId)
        return
      }

      await Promise.all([
        refreshSummary(selectedScheduleId),
        refreshList(selectedScheduleId, dashboardStoreId, selectedScheduleId),
        loadSelectedOrder(orderId),
      ])
    },
    [dashboardStoreId, loadSelectedOrder, refreshList, refreshSummary, selectedScheduleId]
  )

  const handleChangeStatus = useCallback(
    async (orderId: string, orderNumber: string, nextStatus: string) => {
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
        void refreshOrderSurface(orderId)
      } catch (err) {
        setOrders(previousOrders)
        setCounts(previousCounts)
        setSelectedOrder(previousSelectedOrder)
        setError(err instanceof ApiClientError ? err.message : '注文ステータスの更新に失敗しました')
      } finally {
        setPendingStatus(null)
      }
    },
    [
      counts,
      orders,
      refreshOrderSurface,
      selectedOrder,
      setCounts,
      setError,
      setMessage,
      setOrders,
      setSelectedOrder,
      updateOrderInList,
      updateSelectedOrderDetail,
    ]
  )

  const handleSendNotification = useCallback(
    async (orderId: string, notification: MobileOrderNotificationRow) => {
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
    },
    [loadSelectedOrder, setError, setMessage]
  )

  const handleReceivePayment = useCallback(
    async (orderId: string, orderNumber: string) => {
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
        const response = await fetchApi<VendorMobileOrderOrderMutationPayload>(`/api/vendor/mobile-order/orders/${orderId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'receive_payment' }),
        })

        if (response.receipt_print?.attempted) {
          if (response.receipt_print.printed) {
            setMessage(`注文 ${orderNumber} の料金受領を記録し、レシートを印刷しました`)
          } else {
            setMessage(
              `注文 ${orderNumber} の料金受領を記録しました。レシート印刷に失敗しました: ${response.receipt_print.error_message ?? '不明なエラー'}`
            )
          }
        } else {
          setMessage(`注文 ${orderNumber} の料金受領を記録しました`)
        }

        void refreshOrderSurface(orderId)
      } catch (err) {
        setOrders(previousOrders)
        setCounts(previousCounts)
        setSelectedOrder(previousSelectedOrder)
        setError(err instanceof ApiClientError ? err.message : '料金受領の更新に失敗しました')
      } finally {
        setPendingPaymentReceiptOrderId(null)
      }
    },
    [
      counts,
      orders,
      refreshOrderSurface,
      selectedOrder,
      setCounts,
      setError,
      setMessage,
      setOrders,
      setSelectedOrder,
      updateOrderInList,
      updateSelectedOrderDetail,
    ]
  )

  const handleReprintReceipt = useCallback(
    async (orderId: string, orderNumber: string) => {
      setPendingReprintOrderId(orderId)
      setMessage(null)

      try {
        await fetchApi<VendorMobileOrderPrintResultPayload>(`/api/vendor/mobile-order/orders/${orderId}/print`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_reprint: true }),
        })
        setMessage(`注文 ${orderNumber} のレシートを再印刷しました`)
      } catch (err) {
        setError(err instanceof ApiClientError ? err.message : 'レシートの再印刷に失敗しました')
      } finally {
        setPendingReprintOrderId(null)
      }
    },
    [setError, setMessage]
  )

  return {
    pendingStatus,
    pendingPaymentReceiptOrderId,
    pendingNotificationId,
    pendingReprintOrderId,
    handleChangeStatus,
    handleSendNotification,
    handleReceivePayment,
    handleReprintReceipt,
  }
}
