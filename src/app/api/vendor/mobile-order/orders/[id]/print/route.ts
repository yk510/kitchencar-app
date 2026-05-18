import { NextRequest } from 'next/server'
import { apiError } from '@/lib/api-response'
import { EpsonEposPrintError } from '@/lib/receipt-printing/epson-epos'
import { sendVendorOrderReceipt } from '@/lib/receipt-printing/send-vendor-order-receipt'
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
  const body = await req.json().catch(() => ({})) as { is_reprint?: boolean }

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

      try {
        return sendVendorOrderReceipt({
          storeName: store.store_name,
          order,
          receiptSettings,
          isReprint: body.is_reprint === true,
        })
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
