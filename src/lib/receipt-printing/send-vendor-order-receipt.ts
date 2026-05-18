import { sendEpsonReceiptPrint } from '@/lib/receipt-printing/epson-epos'
import { buildReceiptPrintPayload } from '@/lib/receipt-printing-payload'
import type {
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

  if (settings.receipt_printer_provider !== 'epson_epos') {
    throw new Error('未対応のプリンター方式です')
  }
}

export async function sendVendorOrderReceipt(args: {
  storeName: string
  order: VendorMobileOrderDashboardOrder
  receiptSettings: ReceiptPrintSettingsLike
  isReprint?: boolean
}): Promise<VendorMobileOrderPrintResultPayload> {
  validateReceiptPrintSettings(args.receiptSettings)

  const result = await sendEpsonReceiptPrint({
    endpoint: args.receiptSettings.receipt_printer_endpoint ?? '',
    payload: buildReceiptPrintPayload({
      storeName: args.storeName,
      order: args.order,
      isReprint: args.isReprint,
    }),
  })

  return {
    order_id: args.order.id,
    order_number: args.order.order_number,
    is_reprint: args.isReprint ?? false,
    printer_provider: 'epson_epos',
    printer_endpoint: args.receiptSettings.receipt_printer_endpoint ?? '',
    printer_label: args.receiptSettings.receipt_printer_label,
    print_mode: args.receiptSettings.receipt_print_mode,
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
