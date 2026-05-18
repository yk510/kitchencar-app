import type { ReceiptPrintPayload } from '@/types/api-payloads'
import { buildEpsonPrintProbeXml, buildEpsonReceiptPrintXml } from '@/lib/receipt-printing/epson-xml'

type EpsonEposPrintErrorKind = 'invalid_endpoint' | 'network' | 'http' | 'printer'

export class EpsonEposPrintError extends Error {
  kind: EpsonEposPrintErrorKind
  status: number | null
  responseBody: string | null
  printerCode: string | null

  constructor(args: {
    message: string
    kind: EpsonEposPrintErrorKind
    status?: number | null
    responseBody?: string | null
    printerCode?: string | null
  }) {
    super(args.message)
    this.name = 'EpsonEposPrintError'
    this.kind = args.kind
    this.status = args.status ?? null
    this.responseBody = args.responseBody ?? null
    this.printerCode = args.printerCode ?? null
  }
}

export type EpsonEposPrintResult = {
  endpoint: string
  http_status: number
  printer_success: boolean
  printer_code: string | null
  response_text: string
}

function normalizeEndpoint(endpoint: string) {
  const value = endpoint.trim()
  if (!value) {
    throw new EpsonEposPrintError({
      message: 'プリンター接続先が未設定です',
      kind: 'invalid_endpoint',
    })
  }

  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new EpsonEposPrintError({
      message: 'プリンター接続先の URL 形式が不正です',
      kind: 'invalid_endpoint',
    })
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new EpsonEposPrintError({
      message: 'プリンター接続先は http または https の URL を指定してください',
      kind: 'invalid_endpoint',
    })
  }

  return parsed.toString()
}

function parsePrinterResult(responseText: string) {
  const successMatch = responseText.match(/success="(true|false)"/i)
  const codeMatch = responseText.match(/code="([^"]+)"/i)

  return {
    printerSuccess: successMatch ? successMatch[1].toLowerCase() === 'true' : true,
    printerCode: codeMatch?.[1] ?? null,
  }
}

export async function sendEpsonEposPrintXml(args: {
  endpoint: string
  xml: string
  timeoutMs?: number
}): Promise<EpsonEposPrintResult> {
  const endpoint = normalizeEndpoint(args.endpoint)
  const timeoutMs = args.timeoutMs ?? 10_000
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
      },
      body: args.xml,
      cache: 'no-store',
      signal: controller.signal,
    })

    const responseText = await response.text()

    if (!response.ok) {
      throw new EpsonEposPrintError({
        message: `プリンター送信に失敗しました (${response.status})`,
        kind: 'http',
        status: response.status,
        responseBody: responseText,
      })
    }

    const { printerSuccess, printerCode } = parsePrinterResult(responseText)
    if (!printerSuccess) {
      throw new EpsonEposPrintError({
        message: printerCode ? `プリンターが印刷を受け付けませんでした (${printerCode})` : 'プリンターが印刷を受け付けませんでした',
        kind: 'printer',
        status: response.status,
        responseBody: responseText,
        printerCode,
      })
    }

    return {
      endpoint,
      http_status: response.status,
      printer_success: printerSuccess,
      printer_code: printerCode,
      response_text: responseText,
    }
  } catch (error) {
    if (error instanceof EpsonEposPrintError) {
      throw error
    }

    if ((error as { name?: string } | null)?.name === 'AbortError') {
      throw new EpsonEposPrintError({
        message: 'プリンター送信がタイムアウトしました',
        kind: 'network',
      })
    }

    throw new EpsonEposPrintError({
      message: `プリンターへ接続できませんでした: ${String((error as Error)?.message ?? error)}`,
      kind: 'network',
    })
  } finally {
    clearTimeout(timeoutId)
  }
}

export async function sendEpsonReceiptPrint(args: {
  endpoint: string
  payload: ReceiptPrintPayload
  timeoutMs?: number
}) {
  return sendEpsonEposPrintXml({
    endpoint: args.endpoint,
    xml: buildEpsonReceiptPrintXml(args.payload),
    timeoutMs: args.timeoutMs,
  })
}

export async function sendEpsonPrintProbe(args: {
  endpoint: string
  storeName: string
  printerLabel?: string | null
  timeoutMs?: number
}) {
  return sendEpsonEposPrintXml({
    endpoint: args.endpoint,
    xml: buildEpsonPrintProbeXml({
      storeName: args.storeName,
      printerLabel: args.printerLabel,
    }),
    timeoutMs: args.timeoutMs,
  })
}
