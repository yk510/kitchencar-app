import { buildReceiptPrintDocument } from '@/lib/receipt-printing/receipt-print-document'
import type { ReceiptPrintPayload } from '@/types/api-payloads'

function concatBytes(chunks: Uint8Array[]) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0

  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.length
  }

  return result
}

function textBytes(value: string) {
  return new TextEncoder().encode(value)
}

function feed(lines = 1) {
  return Uint8Array.from([0x1b, 0x64, Math.max(0, Math.min(255, lines))])
}

function setAlign(align: 'left' | 'center') {
  return Uint8Array.from([0x1b, 0x61, align === 'center' ? 0x01 : 0x00])
}

function setEmphasis(enabled: boolean) {
  return Uint8Array.from([0x1b, 0x45, enabled ? 0x01 : 0x00])
}

function setSize(widthScale: 1 | 2 = 1, heightScale: 1 | 2 = 1) {
  const width = Math.max(1, Math.min(2, widthScale)) - 1
  const height = Math.max(1, Math.min(2, heightScale)) - 1
  return Uint8Array.from([0x1d, 0x21, (width << 4) | height])
}

function resetPrintMode() {
  return Uint8Array.from([0x1b, 0x40])
}

function cut() {
  return Uint8Array.from([0x1d, 0x56, 0x42, 0x00])
}

export function buildEscPosReceiptBytes(payload: ReceiptPrintPayload) {
  const document = buildReceiptPrintDocument(payload)
  const chunks: Uint8Array[] = [resetPrintMode()]

  for (const section of document.sections) {
    chunks.push(setAlign(section.align))
    chunks.push(setEmphasis(Boolean(section.emphasized)))
    chunks.push(setSize(section.widthScale ?? 1, section.heightScale ?? 1))
    chunks.push(textBytes(section.lines.join('\n')))
    chunks.push(feed(1))
    chunks.push(setEmphasis(false))
    chunks.push(setSize(1, 1))
  }

  chunks.push(feed(3))
  chunks.push(cut())

  return concatBytes(chunks)
}
