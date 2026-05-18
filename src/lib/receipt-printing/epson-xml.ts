import type { ReceiptPrintPayload } from '@/types/api-payloads'
import { buildReceiptPrintDocument } from '@/lib/receipt-printing/receipt-print-document'

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

export function buildEpsonReceiptPrintXml(payload: ReceiptPrintPayload) {
  const document = buildReceiptPrintDocument(payload)

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print">`,
    ...document.sections.flatMap((section) => {
      const attrs = [
        `align="${section.align}"`,
        section.widthScale && section.widthScale > 1 ? `width="${section.widthScale}"` : null,
        section.heightScale && section.heightScale > 1 ? `height="${section.heightScale}"` : null,
        section.emphasized ? `em="true"` : null,
      ]
        .filter(Boolean)
        .join(' ')

      return [`<text ${attrs}>${joinTextLines(section.lines)}</text>`, `<feed line="1"/>`]
    }),
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
