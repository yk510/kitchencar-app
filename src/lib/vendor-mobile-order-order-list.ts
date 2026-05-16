import type {
  VendorMobileOrderListItem,
  VendorMobileOrderOrdersSummaryPayload,
} from '@/types/api-payloads'

export const STATUS_LABELS: Record<string, string> = {
  placed: '受付済',
  preparing: '調理中',
  ready: '完成',
  picked_up: '受取済',
  cancelled: 'キャンセル',
}

export const STATUS_TONE: Record<string, string> = {
  placed: 'bg-sky-100 text-sky-800',
  preparing: 'bg-violet-100 text-violet-800',
  ready: 'bg-emerald-100 text-emerald-800',
  picked_up: 'bg-slate-100 text-slate-700',
  cancelled: 'bg-rose-100 text-rose-700',
}

export const NEXT_ACTIONS: Record<string, Array<{ status: string; label: string }>> = {
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

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: '未受領',
  authorized: '支払済み',
  paid: '受領済み',
  failed: '失敗',
  refunded: '返金済み',
}

export type OrderListFilter = 'all' | 'action_required' | 'preparing' | 'ready' | 'picked_up'

export const EMPTY_COUNTS: VendorMobileOrderOrdersSummaryPayload = {
  placed: 0,
  preparing: 0,
  ready: 0,
  picked_up: 0,
  total: 0,
}

export function isUnhandledOrder(order: { status: string }) {
  return order.status !== 'picked_up' && order.status !== 'cancelled'
}

export function buildCountsFromOrders(
  source: VendorMobileOrderListItem[]
): VendorMobileOrderOrdersSummaryPayload {
  return {
    placed: source.filter((order) => order.status === 'placed').length,
    preparing: source.filter((order) => order.status === 'preparing').length,
    ready: source.filter((order) => order.status === 'ready').length,
    picked_up: source.filter((order) => order.status === 'picked_up').length,
    total: source.length,
  }
}

export function filterAndSortOrders(orders: VendorMobileOrderListItem[], orderListFilter: OrderListFilter) {
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
}

export function createFilterDefinitions(
  orders: VendorMobileOrderListItem[],
  counts: VendorMobileOrderOrdersSummaryPayload
) {
  return [
    { key: 'action_required', label: '未対応', count: orders.filter((order) => isUnhandledOrder(order)).length },
    { key: 'preparing', label: '調理中', count: counts.preparing },
    { key: 'ready', label: '完成', count: counts.ready },
    { key: 'picked_up', label: '受取済', count: counts.picked_up },
    { key: 'all', label: 'すべて', count: counts.total },
  ] as Array<{ key: OrderListFilter; label: string; count: number }>
}
