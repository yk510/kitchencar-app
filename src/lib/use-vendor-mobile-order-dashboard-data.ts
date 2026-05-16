'use client'

import { useCallback, useState } from 'react'
import { ApiClientError, fetchApi } from '@/lib/api-client'
import { buildCountsFromOrders, EMPTY_COUNTS } from '@/lib/vendor-mobile-order-order-list'
import type {
  VendorMobileOrderDashboardOrder,
  VendorMobileOrderListItem,
  VendorMobileOrderOrderDetailPayload,
  VendorMobileOrderOrdersListPayload,
  VendorMobileOrderOrdersPayload,
  VendorMobileOrderOrdersSummaryPayload,
} from '@/types/api-payloads'

type UseVendorMobileOrderDashboardDataArgs = {
  processIncomingOrders: (
    storeId: string,
    responseScheduleId: string | null,
    incomingOrders: VendorMobileOrderListItem[]
  ) => void
}

export function useVendorMobileOrderDashboardData({
  processIncomingOrders,
}: UseVendorMobileOrderDashboardDataArgs) {
  const [dashboard, setDashboard] = useState<VendorMobileOrderOrdersPayload | null>(null)
  const [orders, setOrders] = useState<VendorMobileOrderListItem[]>([])
  const [counts, setCounts] = useState<VendorMobileOrderOrdersSummaryPayload>(EMPTY_COUNTS)
  const [selectedOrder, setSelectedOrder] = useState<VendorMobileOrderDashboardOrder | null>(null)
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null)
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const syncIncomingOrders = useCallback(
    (storeId: string, responseScheduleId: string | null, incomingOrders: VendorMobileOrderListItem[]) => {
      processIncomingOrders(storeId, responseScheduleId, incomingOrders)
      setOrders(incomingOrders)
      setSelectedOrderId((current) => {
        if (current && incomingOrders.some((order) => order.id === current)) {
          return current
        }
        return incomingOrders[0]?.id ?? null
      })
    },
    [processIncomingOrders]
  )

  const updateOrderInList = useCallback(
    (orderId: string, updater: (order: VendorMobileOrderListItem) => VendorMobileOrderListItem) => {
      setOrders((current) => {
        const next = current.map((order) => (order.id === orderId ? updater(order) : order))
        setCounts(buildCountsFromOrders(next))
        return next
      })
    },
    []
  )

  const updateSelectedOrderDetail = useCallback(
    (orderId: string, updater: (order: VendorMobileOrderDashboardOrder) => VendorMobileOrderDashboardOrder) => {
      setSelectedOrder((current) => {
        if (!current || current.id !== orderId) return current
        return updater(current)
      })
    },
    []
  )

  const loadSelectedOrder = useCallback(async (orderId: string | null) => {
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
  }, [])

  const refreshSummary = useCallback(async (scheduleId: string | null) => {
    const search = scheduleId ? `?schedule_id=${encodeURIComponent(scheduleId)}` : ''
    const response = await fetchApi<VendorMobileOrderOrdersSummaryPayload>(
      `/api/vendor/mobile-order/orders/summary${search}`,
      {
        cache: 'no-store',
      }
    )
    setCounts(response)
  }, [])

  const refreshList = useCallback(
    async (scheduleId: string | null, storeId: string, responseScheduleId: string | null) => {
      const search = scheduleId ? `?schedule_id=${encodeURIComponent(scheduleId)}` : ''
      const response = await fetchApi<VendorMobileOrderOrdersListPayload>(
        `/api/vendor/mobile-order/orders/list${search}`,
        {
          cache: 'no-store',
        }
      )
      syncIncomingOrders(storeId, responseScheduleId, response.orders)
    },
    [syncIncomingOrders]
  )

  const shouldRefreshSelectedOrderDetail = useCallback(
    (nextOrders: VendorMobileOrderListItem[]) => {
      if (!selectedOrderId || !selectedOrder) return false

      const selectedListOrder = nextOrders.find((order) => order.id === selectedOrderId)
      if (!selectedListOrder) return true

      return (
        selectedListOrder.status !== selectedOrder.status ||
        selectedListOrder.payment_status !== selectedOrder.payment_status ||
        selectedListOrder.updated_at !== selectedOrder.updated_at ||
        selectedListOrder.total_amount !== selectedOrder.total_amount
      )
    },
    [selectedOrder, selectedOrderId]
  )

  const loadDashboard = useCallback(
    async (scheduleId?: string | null) => {
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
    },
    [syncIncomingOrders]
  )

  const changeSchedule = useCallback(
    async (scheduleId: string, onBeforeReload?: () => void) => {
      setLoading(true)
      onBeforeReload?.()
      await loadDashboard(scheduleId)
    },
    [loadDashboard]
  )

  return {
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
  }
}
