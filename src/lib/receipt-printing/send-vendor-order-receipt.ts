import { sendEpsonReceiptPrint } from '@/lib/receipt-printing/epson-epos'
import { buildNativeReceiptPrintRequest } from '@/lib/receipt-printing/native-print-bridge'
import { buildReceiptPrintPayload } from '@/lib/receipt-printing-payload'
import type {
  VendorMobileOrderNativePrintDispatchPayload,
  VendorMobileOrderPrintDispatchPayload,
  VendorMobileOrderDashboardOrder,
  VendorMobileOrderPrintResultPayload,
  VendorMobileOrderReceiptPrintStatusPayload,
  ReceiptPrintMode,
  ReceiptPrinterProvider,
} from '@/types/api-payloads'

type ReceiptPrintSettingsLike = {
  is_receipt_print_enabled: boolean
  receipt_printer_provider: ReceiptPrinterProvider | null
  receipt_printer_endpoint: string | null
  receipt_printer_label: string | null
  receipt_print_mode: ReceiptPrintMode | null
}

function validateReceiptPrintSettings(settings: ReceiptPrintSettingsLike) {
  if (!settings.is_receipt_print_enabled) {
    throw new Error('レシート印刷が有効化されていません')
  }

  if (!settings.receipt_printer_provider) {
    throw new Error('未対応のプリンター方式です')
  }
}

function buildReceiptPayload(args: {
  storeName: string
  order: VendorMobileOrderDashboardOrder
  isReprint?: boolean
}) {
  return buildReceiptPrintPayload({
    storeName: args.storeName,
    order: args.order,
    isReprint: args.isReprint,
  })
}

export function buildNativeVendorOrderReceiptDispatch(args: {
  storeName: string
  order: VendorMobileOrderDashboardOrder
  receiptSettings: ReceiptPrintSettingsLike
  isReprint?: boolean
}): VendorMobileOrderNativePrintDispatchPayload {
  validateReceiptPrintSettings(args.receiptSettings)

  if (args.receiptSettings.receipt_printer_provider !== 'ios_webview_wrapper') {
    throw new Error('iOS WebView ラッパー以外では native bridge を使えません')
  }

  return {
    order_id: args.order.id,
    order_number: args.order.order_number,
    is_reprint: args.isReprint ?? false,
    printer_provider: 'ios_webview_wrapper',
    printer_endpoint: args.receiptSettings.receipt_printer_endpoint ?? '',
    printer_label: args.receiptSettings.receipt_printer_label,
    print_mode: args.receiptSettings.receipt_print_mode,
    delivery: 'native_bridge',
    native_request: buildNativeReceiptPrintRequest({
      payload: buildReceiptPayload(args),
      mode: 'ios_webview_wrapper',
      intent: args.isReprint ? 'reprint' : 'auto_print',
      origin: args.isReprint ? 'vendor_mobile_order_orders' : 'store_pos',
    }),
  }
}

export async function sendVendorOrderReceipt(args: {
  storeName: string
  order: VendorMobileOrderDashboardOrder
  receiptSettings: ReceiptPrintSettingsLike
  isReprint?: boolean
}): Promise<VendorMobileOrderPrintDispatchPayload> {
  validateReceiptPrintSettings(args.receiptSettings)

  if (args.receiptSettings.receipt_printer_provider === 'ios_webview_wrapper') {
    return buildNativeVendorOrderReceiptDispatch(args)
  }

  const result = await sendEpsonReceiptPrint({
    endpoint: args.receiptSettings.receipt_printer_endpoint ?? '',
    payload: buildReceiptPayload(args),
  })

  return {
    order_id: args.order.id,
    order_number: args.order.order_number,
    is_reprint: args.isReprint ?? false,
    printer_provider: 'epson_epos',
    printer_endpoint: args.receiptSettings.receipt_printer_endpoint ?? '',
    printer_label: args.receiptSettings.receipt_printer_label,
    print_mode: args.receiptSettings.receipt_print_mode,
    delivery: 'server_print',
    result,
  }
}

export async function tryAutoPrintVendorOrderReceipt(args: {
  storeName: string
  order: VendorMobileOrderDashboardOrder
  receiptSettings: ReceiptPrintSettingsLike
}): Promise<VendorMobileOrderReceiptPrintStatusPayload> {
  if (!args.receiptSettings.is_receipt_print_enabled) {
    return {
      attempted: false,
      printed: false,
      is_reprint: false,
      error_message: null,
      result: null,
    }
  }

  try {
    const printResult = await sendVendorOrderReceipt({
      storeName: args.storeName,
      order: args.order,
      receiptSettings: args.receiptSettings,
    })

    if (printResult.delivery === 'native_bridge') {
      return {
        attempted: false,
        printed: false,
        is_reprint: false,
        error_message: 'iPad WebView ラッパー向けの自動印刷は、次の Ticket で接続します。',
        result: null,
      }
    }

    return {
      attempted: true,
      printed: true,
      is_reprint: false,
      error_message: null,
      result: printResult.result,
    }
  } catch (error) {
    return {
      attempted: true,
      printed: false,
      is_reprint: false,
      error_message: error instanceof Error ? error.message : 'レシート印刷に失敗しました',
      result: null,
    }
  }
}
