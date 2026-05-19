import { buildReceiptPrintPlainText } from '@/lib/receipt-printing/receipt-print-document'
import type { ReceiptPrintPayload } from '@/types/api-payloads'

declare global {
  interface Window {
    webkit?: {
      messageHandlers?: {
        kuridasPrinter?: {
          postMessage(payload: unknown): void
        }
      }
    }
  }
}

export type NativeReceiptBridgeMode = 'ios_helper_app' | 'ios_webview_wrapper'

export type NativeReceiptPrintRequest = {
  kind: 'receipt_print'
  mode: NativeReceiptBridgeMode
  request_id: string
  created_at: string
  payload: ReceiptPrintPayload
  plain_text: string
  printer_hint: {
    vendor: 'sii_mp_b20'
    connection: 'bluetooth'
  }
  callback_url: string | null
}

export type NativeReceiptBridgeDispatchResult = {
  mode: NativeReceiptBridgeMode
  dispatched: boolean
  mechanism: 'webkit_message_handler' | 'custom_url_scheme'
}

function buildRequestId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `receipt-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function buildNativeReceiptPrintRequest(args: {
  payload: ReceiptPrintPayload
  mode: NativeReceiptBridgeMode
  callbackUrl?: string | null
}): NativeReceiptPrintRequest {
  return {
    kind: 'receipt_print',
    mode: args.mode,
    request_id: buildRequestId(),
    created_at: new Date().toISOString(),
    payload: args.payload,
    plain_text: buildReceiptPrintPlainText(args.payload),
    printer_hint: {
      vendor: 'sii_mp_b20',
      connection: 'bluetooth',
    },
    callback_url: args.callbackUrl ?? null,
  }
}

export function canUseIosWebkitPrinterBridge() {
  if (typeof window === 'undefined') return false
  return typeof window.webkit?.messageHandlers?.kuridasPrinter?.postMessage === 'function'
}

function buildHelperAppUrl(request: NativeReceiptPrintRequest) {
  const encoded = encodeURIComponent(JSON.stringify(request))
  return `kuridas-printer://print?payload=${encoded}`
}

export function dispatchNativeReceiptPrint(request: NativeReceiptPrintRequest): NativeReceiptBridgeDispatchResult {
  if (canUseIosWebkitPrinterBridge()) {
    window.webkit!.messageHandlers!.kuridasPrinter!.postMessage(request)
    return {
      mode: request.mode,
      dispatched: true,
      mechanism: 'webkit_message_handler',
    }
  }

  if (typeof window !== 'undefined') {
    window.location.href = buildHelperAppUrl(request)
    return {
      mode: request.mode,
      dispatched: true,
      mechanism: 'custom_url_scheme',
    }
  }

  return {
    mode: request.mode,
    dispatched: false,
    mechanism: 'custom_url_scheme',
  }
}
