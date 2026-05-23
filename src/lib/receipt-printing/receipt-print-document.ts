import type { ReceiptPrintPayload } from "@/types/api-payloads";

export type ReceiptPrintDocumentSection = {
  align: "left" | "center";
  emphasized?: boolean;
  widthScale?: 1 | 2;
  heightScale?: 1 | 2;
  lines: string[];
};

function formatOptionPriceDelta(value: number) {
  if (value === 0) return "";
  const sign = value > 0 ? "+" : "-";
  return ` (${sign}${Math.abs(value).toLocaleString("ja-JP")}円)`;
}

function toDisplayWidth(value: string) {
  return Array.from(value).length;
}

function buildItemHeadline(productName: string, quantity: number) {
  const quantityLabel = `×${quantity}`;
  const lineWidth = 32;
  const spaceCount = Math.max(
    1,
    lineWidth - toDisplayWidth(productName) - toDisplayWidth(quantityLabel),
  );
  return `${productName}${" ".repeat(spaceCount)}${quantityLabel}`;
}

export type ReceiptPrintDocument = {
  orderId: string;
  sections: ReceiptPrintDocumentSection[];
};

export function buildReceiptPrintBodyLines(payload: ReceiptPrintPayload) {
  const lines: string[] = [payload.body.label, ""];

  for (const item of payload.body.items) {
    lines.push(buildItemHeadline(item.product_name, item.quantity));
    for (const option of item.options) {
      lines.push(
        `  ${option.option_group_name}: ${option.option_choice_name}${formatOptionPriceDelta(option.price_delta)}`,
      );
    }
    lines.push("");
  }

  return lines;
}

export function buildReceiptPrintFooterLines(payload: ReceiptPrintPayload) {
  return [payload.footer.store_name, payload.footer.ordered_at_label];
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
