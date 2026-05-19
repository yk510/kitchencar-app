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
export type NativeReceiptPrintIntent = 'auto_print' | 'reprint' | 'probe'
export type NativeReceiptPrintOrigin = 'vendor_mobile_order_orders' | 'store_pos' | 'vendor_mobile_order_settings'

export const NATIVE_RECEIPT_BRIDGE_VERSION = 1
export const NATIVE_RECEIPT_BRIDGE_HANDLER_NAME = 'kuridasPrinter'
export const NATIVE_RECEIPT_BRIDGE_CALLBACK_EVENT = 'kuridas:native-receipt-print'

type NativeReceiptPrintRequestCallback = {
  event_name: typeof NATIVE_RECEIPT_BRIDGE_CALLBACK_EVENT
  callback_url: string | null
}

export type NativeReceiptPrintRequest = {
  kind: 'receipt_print'
  bridge_version: typeof NATIVE_RECEIPT_BRIDGE_VERSION
  mode: NativeReceiptBridgeMode
  intent: NativeReceiptPrintIntent
  origin: NativeReceiptPrintOrigin
  request_id: string
  created_at: string
  payload: ReceiptPrintPayload
  plain_text: string
  printer_hint: {
    vendor: 'sii_mp_b20'
    connection: 'bluetooth'
  }
  callback: NativeReceiptPrintRequestCallback
}

export type NativeReceiptBridgeDispatchResult = {
  mode: NativeReceiptBridgeMode
  dispatched: boolean
  mechanism: 'webkit_message_handler' | 'custom_url_scheme'
}

export type NativeReceiptBridgeCallbackPayload = {
  kind: 'receipt_print_result'
  bridge_version: typeof NATIVE_RECEIPT_BRIDGE_VERSION
  request_id: string
  status: 'accepted' | 'printed' | 'failed' | 'unsupported'
  printer_vendor: 'sii_mp_b20'
  printer_connection: 'bluetooth'
  error_code: string | null
  error_message: string | null
  printed_at: string | null
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
  intent: NativeReceiptPrintIntent
  origin: NativeReceiptPrintOrigin
  callbackUrl?: string | null
}): NativeReceiptPrintRequest {
  return {
    kind: 'receipt_print',
    bridge_version: NATIVE_RECEIPT_BRIDGE_VERSION,
    mode: args.mode,
    intent: args.intent,
    origin: args.origin,
    request_id: buildRequestId(),
    created_at: new Date().toISOString(),
    payload: args.payload,
    plain_text: buildReceiptPrintPlainText(args.payload),
    printer_hint: {
      vendor: 'sii_mp_b20',
      connection: 'bluetooth',
    },
    callback: {
      event_name: NATIVE_RECEIPT_BRIDGE_CALLBACK_EVENT,
      callback_url: args.callbackUrl ?? null,
    },
  }
}

export function canUseIosWebkitPrinterBridge() {
  if (typeof window === 'undefined') return false
  return typeof window.webkit?.messageHandlers?.[NATIVE_RECEIPT_BRIDGE_HANDLER_NAME]?.postMessage === 'function'
}

function buildHelperAppUrl(request: NativeReceiptPrintRequest) {
  const encoded = encodeURIComponent(JSON.stringify(request))
  return `kuridas-printer://print?payload=${encoded}`
}

export function dispatchNativeReceiptPrint(request: NativeReceiptPrintRequest): NativeReceiptBridgeDispatchResult {
  if (canUseIosWebkitPrinterBridge()) {
    window.webkit!.messageHandlers![NATIVE_RECEIPT_BRIDGE_HANDLER_NAME]!.postMessage(request)
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

export function isNativeReceiptBridgeCallbackPayload(value: unknown): value is NativeReceiptBridgeCallbackPayload {
  if (!value || typeof value !== 'object') return false

  const payload = value as Partial<NativeReceiptBridgeCallbackPayload>

  return (
    payload.kind === 'receipt_print_result' &&
    payload.bridge_version === NATIVE_RECEIPT_BRIDGE_VERSION &&
    typeof payload.request_id === 'string' &&
    (payload.status === 'accepted' ||
      payload.status === 'printed' ||
      payload.status === 'failed' ||
      payload.status === 'unsupported')
  )
}

export function addNativeReceiptPrintCallbackListener(
  listener: (payload: NativeReceiptBridgeCallbackPayload) => void,
): () => void {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const handleEvent = (event: Event) => {
    const detail = (event as CustomEvent<unknown>).detail
    if (isNativeReceiptBridgeCallbackPayload(detail)) {
      listener(detail)
    }
  }

  window.addEventListener(NATIVE_RECEIPT_BRIDGE_CALLBACK_EVENT, handleEvent as EventListener)

  return () => {
    window.removeEventListener(NATIVE_RECEIPT_BRIDGE_CALLBACK_EVENT, handleEvent as EventListener)
  }
}
