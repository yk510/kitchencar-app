import { resolveMobileOrderSource } from "@/lib/mobile-order-fields";
import type {
  ReceiptPrintItemInput,
  ReceiptPrintLinePayload,
  ReceiptPrintPayload,
  VendorMobileOrderDashboardOrder,
} from "@/types/api-payloads";

function formatReceiptOrderedAt(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatReceiptPrice(value: number) {
  return `${value.toLocaleString("ja-JP")}円`;
}

function resolveReceiptOrderSourceLabel(
  order:
    | VendorMobileOrderDashboardOrder
    | { order_source: "store_pos" | "mobile_order" },
) {
  return resolveMobileOrderSource(order) === "store_pos"
    ? "店頭POS注文"
    : "モバイル注文";
}

function sortOptions(
  options: VendorMobileOrderDashboardOrder["mobile_order_items"][number]["mobile_order_item_option_choices"],
) {
  return [...options].sort((left, right) => {
    const groupCompare = left.option_group_name_snapshot.localeCompare(
      right.option_group_name_snapshot,
      "ja",
    );
    if (groupCompare !== 0) return groupCompare;
    return left.option_choice_name_snapshot.localeCompare(
      right.option_choice_name_snapshot,
      "ja",
    );
  });
}

function sortGenericOptions(options: ReceiptPrintItemInput["options"]) {
  return [...options].sort((left, right) => {
    const groupCompare = left.option_group_name.localeCompare(
      right.option_group_name,
      "ja",
    );
    if (groupCompare !== 0) return groupCompare;
    return left.option_choice_name.localeCompare(
      right.option_choice_name,
      "ja",
    );
  });
}

export function buildReceiptPrintLinePayload(
  item: VendorMobileOrderDashboardOrder["mobile_order_items"][number],
): ReceiptPrintLinePayload {
  return {
    order_item_id: item.id,
    product_name: item.product_name_snapshot,
    quantity: item.quantity,
    unit_price: item.unit_price_snapshot,
    line_total_amount: item.line_total_amount,
    options: sortOptions(item.mobile_order_item_option_choices).map(
      (option) => ({
        option_group_name: option.option_group_name_snapshot,
        option_choice_name: option.option_choice_name_snapshot,
        price_delta: option.price_delta_snapshot,
      }),
    ),
  };
}

export function buildReceiptPrintLinePayloadFromInput(
  item: ReceiptPrintItemInput,
): ReceiptPrintLinePayload {
  return {
    order_item_id: item.order_item_id,
    product_name: item.product_name,
    quantity: item.quantity,
    unit_price: item.unit_price,
    line_total_amount: item.line_total_amount,
    options: sortGenericOptions(item.options).map((option) => ({
      option_group_name: option.option_group_name,
      option_choice_name: option.option_choice_name,
      price_delta: option.price_delta,
    })),
  };
}

export function buildReceiptPrintPayload(args: {
  storeName: string;
  order: VendorMobileOrderDashboardOrder;
  isReprint?: boolean;
}): ReceiptPrintPayload {
  const items = args.order.mobile_order_items.map(buildReceiptPrintLinePayload);

  return {
    order_id: args.order.id,
    order_source: args.order.order_source,
    header: {
      label: "注文番号",
      value: args.order.order_number,
      badge_label: args.isReprint ? "再印刷" : null,
    },
    body: {
      label: "注文内容",
      items,
      item_count: items.length,
      total_quantity: items.reduce((sum, item) => sum + item.quantity, 0),
    },
    summary: {
      order_source_label: resolveReceiptOrderSourceLabel(args.order),
      total_amount: args.order.total_amount,
      total_amount_label: formatReceiptPrice(args.order.total_amount),
    },
    footer: {
      store_name: args.storeName,
      ordered_at: args.order.ordered_at,
      ordered_at_label: formatReceiptOrderedAt(args.order.ordered_at),
    },
  };
}

export function buildReceiptPrintPayloadFromStorePos(args: {
  storeName: string;
  orderId: string;
  orderNumber: string;
  orderedAt: string;
  totalAmount: number;
  items: ReceiptPrintItemInput[];
  isReprint?: boolean;
}): ReceiptPrintPayload {
  const items = args.items.map(buildReceiptPrintLinePayloadFromInput);

  return {
    order_id: args.orderId,
    order_source: "store_pos",
    header: {
      label: "注文番号",
      value: args.orderNumber,
      badge_label: args.isReprint ? "再印刷" : null,
    },
    body: {
      label: "注文内容",
      items,
      item_count: items.length,
      total_quantity: items.reduce((sum, item) => sum + item.quantity, 0),
    },
    summary: {
      order_source_label: "店頭POS注文",
      total_amount: args.totalAmount,
      total_amount_label: formatReceiptPrice(args.totalAmount),
    },
    footer: {
      store_name: args.storeName,
      ordered_at: args.orderedAt,
      ordered_at_label: formatReceiptOrderedAt(args.orderedAt),
    },
  };
}

export function buildReceiptPrintPreviewPayload(
  storeName: string,
): ReceiptPrintPayload {
  const orderedAt = new Date().toISOString();

  return {
    order_id: "preview-order",
    order_source: "store_pos",
    header: {
      label: "注文番号",
      value: "1842-0012",
      badge_label: null,
    },
    body: {
      label: "注文内容",
      items: [
        {
          order_item_id: "preview-item-1",
          product_name: "牛すじカレー",
          quantity: 2,
          unit_price: 1200,
          line_total_amount: 2400,
          options: [
            {
              option_group_name: "辛さ",
              option_choice_name: "中辛",
              price_delta: 0,
            },
            {
              option_group_name: "トッピング",
              option_choice_name: "チーズ",
              price_delta: 150,
            },
          ],
        },
        {
          order_item_id: "preview-item-2",
          product_name: "マンゴーラッシー",
          quantity: 1,
          unit_price: 450,
          line_total_amount: 450,
          options: [],
        },
      ],
      item_count: 2,
      total_quantity: 3,
    },
    summary: {
      order_source_label: "店頭POS注文",
      total_amount: 2850,
      total_amount_label: formatReceiptPrice(2850),
    },
    footer: {
      store_name: storeName,
      ordered_at: orderedAt,
      ordered_at_label: formatReceiptOrderedAt(orderedAt),
    },
  };
}
