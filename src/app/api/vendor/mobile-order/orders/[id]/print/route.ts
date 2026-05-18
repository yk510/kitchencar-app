import { NextRequest } from 'next/server'
import { apiError } from '@/lib/api-response'
import { sendEpsonReceiptPrint, EpsonEposPrintError } from '@/lib/receipt-printing/epson-epos'
import { buildReceiptPrintPayload } from '@/lib/receipt-printing-payload'
import { getVendorOrderReceiptPrintContext } from '@/lib/vendor-mobile-order-dashboard-api'
import { executeVendorMobileOrderRoute } from '@/lib/vendor-mobile-order-route'
import type { VendorMobileOrderPrintResultPayload } from '@/types/api-payloads'

function toReceiptPrintErrorResponse(error: EpsonEposPrintError) {
  if (error.kind === 'invalid_endpoint') {
    return apiError(error.message, 400)
  }

  return apiError(error.message, 409)
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params

  return executeVendorMobileOrderRoute<VendorMobileOrderPrintResultPayload>(
    req,
    '[vendor/mobile-order/orders/:id/print POST]',
    async ({ supabase, user }) => {
      const { store, order, receiptSettings } = await getVendorOrderReceiptPrintContext(supabase, user, id)

      if (!receiptSettings.is_receipt_print_enabled) {
        return apiError('レシート印刷が有効化されていません', 409)
      }

      if (receiptSettings.receipt_printer_provider !== 'epson_epos') {
        return apiError('未対応のプリンター方式です', 409)
      }

      const payload = buildReceiptPrintPayload({
        storeName: store.store_name,
        order,
      })

      try {
        const result = await sendEpsonReceiptPrint({
          endpoint: receiptSettings.receipt_printer_endpoint ?? '',
          payload,
        })

        return {
          order_id: order.id,
          order_number: order.order_number,
          printer_provider: receiptSettings.receipt_printer_provider,
          printer_endpoint: receiptSettings.receipt_printer_endpoint ?? '',
          printer_label: receiptSettings.receipt_printer_label,
          print_mode: receiptSettings.receipt_print_mode,
          result,
        }
      } catch (error) {
        if (error instanceof EpsonEposPrintError) {
          return toReceiptPrintErrorResponse(error)
        }
        throw error
      }
    },
    {
      notFound: ['対象の注文が見つかりません'],
    }
  )
}
