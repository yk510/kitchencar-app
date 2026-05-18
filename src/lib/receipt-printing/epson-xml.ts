import type { ReceiptPrintPayload } from '@/types/api-payloads'

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function joinTextLines(lines: string[]) {
  return escapeXml(lines.filter(Boolean).join('\n'))
}

function buildReceiptBodyLines(payload: ReceiptPrintPayload) {
  const lines: string[] = [payload.body.label, '']

  for (const item of payload.body.items) {
    lines.push(`${item.product_name} ×${item.quantity}`)
    for (const option of item.options) {
      lines.push(`  ${option.option_group_name}: ${option.option_choice_name}`)
    }
    lines.push('')
  }

  lines.push(`商品数 ${payload.body.item_count} / 点数 ${payload.body.total_quantity}`)
  return lines
}

export function buildEpsonReceiptPrintXml(payload: ReceiptPrintPayload) {
  const bodyLines = buildReceiptBodyLines(payload)
  const footerLines = [payload.footer.store_name, payload.footer.ordered_at_label]
  const headerBadgeLines = payload.header.badge_label ? [`【${payload.header.badge_label}】`] : []

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print">`,
    ...(headerBadgeLines.length > 0
      ? [
          `<text align="center">${joinTextLines(headerBadgeLines)}</text>`,
          `<feed line="1"/>`,
        ]
      : []),
    `<text align="center">${joinTextLines([payload.header.label])}</text>`,
    `<feed line="1"/>`,
    `<text align="center" width="2" height="2" em="true">${joinTextLines([payload.header.value])}</text>`,
    `<feed line="1"/>`,
    `<text align="left">${joinTextLines(['------------------------------'])}</text>`,
    `<text align="left">${joinTextLines(bodyLines)}</text>`,
    `<feed line="1"/>`,
    `<text align="left">${joinTextLines(['------------------------------'])}</text>`,
    `<text align="center">${joinTextLines(footerLines)}</text>`,
    `<feed line="3"/>`,
    `<cut type="feed"/>`,
    `</epos-print>`,
  ].join('')
}

export function buildEpsonPrintProbeXml(args: {
  storeName: string
  printerLabel?: string | null
}) {
  const lines = [
    'レシート印刷テスト',
    '',
    args.storeName,
    args.printerLabel ? `printer: ${args.printerLabel}` : '',
    'Epson ePOS Print 接続確認',
  ].filter(Boolean)

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print">`,
    `<text align="center" em="true">${joinTextLines(lines)}</text>`,
    `<feed line="3"/>`,
    `<cut type="feed"/>`,
    `</epos-print>`,
  ].join('')
}
