import type {
  ReceiptPrintLinePayload,
  ReceiptPrintPayload,
  VendorMobileOrderDashboardOrder,
} from '@/types/api-payloads'

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

function sortOptions(
  options: VendorMobileOrderDashboardOrder['mobile_order_items'][number]['mobile_order_item_option_choices']
) {
  return [...options].sort((left, right) => {
    const groupCompare = left.option_group_name_snapshot.localeCompare(right.option_group_name_snapshot, 'ja')
    if (groupCompare !== 0) return groupCompare
    return left.option_choice_name_snapshot.localeCompare(right.option_choice_name_snapshot, 'ja')
  })
}

export function buildReceiptPrintLinePayload(
  item: VendorMobileOrderDashboardOrder['mobile_order_items'][number]
): ReceiptPrintLinePayload {
  return {
    order_item_id: item.id,
    product_name: item.product_name_snapshot,
    quantity: item.quantity,
    unit_price: item.unit_price_snapshot,
    line_total_amount: item.line_total_amount,
    options: sortOptions(item.mobile_order_item_option_choices).map((option) => ({
      option_group_name: option.option_group_name_snapshot,
      option_choice_name: option.option_choice_name_snapshot,
      price_delta: option.price_delta_snapshot,
    })),
  }
}

export function buildReceiptPrintPayload(args: {
  storeName: string
  order: VendorMobileOrderDashboardOrder
}): ReceiptPrintPayload {
  const items = args.order.mobile_order_items.map(buildReceiptPrintLinePayload)

  return {
    order_id: args.order.id,
    order_source: args.order.order_source,
    header: {
      label: '注文番号',
      value: args.order.order_number,
    },
    body: {
      label: '注文内容',
      items,
      item_count: items.length,
      total_quantity: items.reduce((sum, item) => sum + item.quantity, 0),
    },
    footer: {
      store_name: args.storeName,
      ordered_at: args.order.ordered_at,
      ordered_at_label: formatReceiptOrderedAt(args.order.ordered_at),
    },
  }
}

export function buildReceiptPrintPreviewPayload(storeName: string): ReceiptPrintPayload {
  const orderedAt = new Date().toISOString()

  return {
    order_id: 'preview-order',
    order_source: 'store_pos',
    header: {
      label: '注文番号',
      value: '1842-0012',
    },
    body: {
      label: '注文内容',
      items: [
        {
          order_item_id: 'preview-item-1',
          product_name: '牛すじカレー',
          quantity: 2,
          unit_price: 1200,
          line_total_amount: 2400,
          options: [
            {
              option_group_name: '辛さ',
              option_choice_name: '中辛',
              price_delta: 0,
            },
            {
              option_group_name: 'トッピング',
              option_choice_name: 'チーズ',
              price_delta: 150,
            },
          ],
        },
        {
          order_item_id: 'preview-item-2',
          product_name: 'マンゴーラッシー',
          quantity: 1,
          unit_price: 450,
          line_total_amount: 450,
          options: [],
        },
      ],
      item_count: 2,
      total_quantity: 3,
    },
    footer: {
      store_name: storeName,
      ordered_at: orderedAt,
      ordered_at_label: formatReceiptOrderedAt(orderedAt),
    },
  }
}
