import type { ReceiptPrintLinePayload, ReceiptPrintPayload } from '@/types/api-payloads'

type StorePosReceiptPrintItemInput = {
  order_item_id: string
  product_name: string
  quantity: number
  unit_price: number
  line_total_amount: number
  options: Array<{
    option_group_name: string
    option_choice_name: string
    price_delta: number
  }>
}

function formatReceiptOrderedAt(value: string) {
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatReceiptPrice(value: number) {
  return `${value.toLocaleString('ja-JP')}円`
}

function buildStorePosReceiptLinePayload(item: StorePosReceiptPrintItemInput): ReceiptPrintLinePayload {
  return {
    order_item_id: item.order_item_id,
    product_name: item.product_name,
    quantity: item.quantity,
    unit_price: item.unit_price,
    line_total_amount: item.line_total_amount,
    options: [...item.options].sort((left, right) => {
      const groupCompare = left.option_group_name.localeCompare(right.option_group_name, 'ja')
      if (groupCompare !== 0) return groupCompare
      return left.option_choice_name.localeCompare(right.option_choice_name, 'ja')
    }),
  }
}

export function buildStorePosReceiptPrintPayload(args: {
  storeName: string
  orderId: string
  orderNumber: string
  orderedAt: string
  totalAmount: number
  items: StorePosReceiptPrintItemInput[]
  isReprint?: boolean
}): ReceiptPrintPayload {
  const items = args.items.map(buildStorePosReceiptLinePayload)
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0)

  return {
    order_id: args.orderId,
    order_source: 'store_pos',
    header: {
      label: '注文番号',
      value: args.orderNumber,
      badge_label: args.isReprint ? '再印刷' : null,
    },
    body: {
      label: '注文内容',
      items,
      item_count: items.length,
      total_quantity: totalQuantity,
    },
    summary: {
      order_source_label: '店頭POS注文',
      total_amount: args.totalAmount,
      total_amount_label: formatReceiptPrice(args.totalAmount),
    },
    footer: {
      store_name: args.storeName,
      ordered_at: args.orderedAt,
      ordered_at_label: formatReceiptOrderedAt(args.orderedAt),
    },
  }
}
