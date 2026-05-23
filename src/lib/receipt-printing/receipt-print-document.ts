import type { ReceiptPrintPayload } from "@/types/api-payloads";

export type ReceiptPrintDocumentSection = {
  align: "left" | "center";
  emphasized?: boolean;
  widthScale?: 1 | 2;
  heightScale?: 1 | 2;
  lines: string[];
};

function formatYen(value: number) {
  return `${value.toLocaleString("ja-JP")}円`;
}

function formatOptionPriceDelta(value: number) {
  if (value === 0) return "";
  const sign = value > 0 ? "+" : "-";
  return ` (${sign}${formatYen(Math.abs(value))})`;
}

export type ReceiptPrintDocument = {
  orderId: string;
  sections: ReceiptPrintDocumentSection[];
};

export function buildReceiptPrintBodyLines(payload: ReceiptPrintPayload) {
  const lines: string[] = [
    payload.body.label,
    `受付種別: ${payload.summary.order_source_label}`,
    "",
  ];

  for (const item of payload.body.items) {
    lines.push(item.product_name);
    lines.push(
      `  ${item.quantity} x ${formatYen(item.unit_price)} = ${formatYen(item.line_total_amount)}`,
    );
    for (const option of item.options) {
      lines.push(
        `   - ${option.option_group_name}: ${option.option_choice_name}${formatOptionPriceDelta(option.price_delta)}`,
      );
    }
    lines.push("");
  }

  lines.push(
    `商品数 ${payload.body.item_count} / 点数 ${payload.body.total_quantity}`,
  );
  lines.push(`合計 ${payload.summary.total_amount_label}`);
  return lines;
}

export function buildReceiptPrintFooterLines(payload: ReceiptPrintPayload) {
  return [
    payload.footer.store_name,
    payload.footer.ordered_at_label,
    `注文ID ${payload.order_id.slice(0, 8)}`,
  ];
}

export function buildReceiptPrintDocument(
  payload: ReceiptPrintPayload,
): ReceiptPrintDocument {
  const sections: ReceiptPrintDocumentSection[] = [];

  if (payload.header.badge_label) {
    sections.push({
      align: "center",
      lines: [`【${payload.header.badge_label}】`],
    });
  }

  sections.push(
    {
      align: "center",
      lines: [payload.header.label],
    },
    {
      align: "center",
      emphasized: true,
      widthScale: 2,
      heightScale: 2,
      lines: [payload.header.value],
    },
    {
      align: "left",
      lines: ["------------------------------"],
    },
    {
      align: "left",
      lines: buildReceiptPrintBodyLines(payload),
    },
    {
      align: "left",
      lines: ["------------------------------"],
    },
    {
      align: "center",
      lines: buildReceiptPrintFooterLines(payload),
    },
  );

  return {
    orderId: payload.order_id,
    sections,
  };
}

export function buildReceiptPrintPlainText(payload: ReceiptPrintPayload) {
  const document = buildReceiptPrintDocument(payload);
  return document.sections.flatMap((section) => section.lines).join("\n");
}
