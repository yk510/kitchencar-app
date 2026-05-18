import { NextRequest } from 'next/server'
import { apiError } from '@/lib/api-response'
import { loadVendorMobileOrderAdminStoreContext } from '@/lib/vendor-mobile-order-admin'
import { EpsonEposPrintError, sendEpsonPrintProbe } from '@/lib/receipt-printing/epson-epos'
import { resolveReceiptPrintSettings } from '@/lib/receipt-print-settings'
import { executeVendorMobileOrderRoute } from '@/lib/vendor-mobile-order-route'
import type { VendorReceiptPrintProbePayload } from '@/types/api-payloads'

function toProbeErrorResponse(error: EpsonEposPrintError) {
  if (error.kind === 'invalid_endpoint') {
    return apiError(error.message, 400)
  }

  return apiError(error.message, 409)
}

export async function POST(req: NextRequest) {
  return executeVendorMobileOrderRoute<VendorReceiptPrintProbePayload>(
    req,
    '[vendor/mobile-order/settings/print-probe POST]',
    async ({ supabase, user }) => {
      const { data: vendorProfile } = await (supabase as any)
        .from('vendor_profiles')
        .select('business_name')
        .eq('user_id', user.id)
        .maybeSingle()

      const { store, orderPage } = await loadVendorMobileOrderAdminStoreContext(
        supabase,
        user,
        vendorProfile?.business_name ?? null
      )
      const receiptSettings = resolveReceiptPrintSettings(store, orderPage)

      if (receiptSettings.receipt_printer_provider !== 'epson_epos') {
        return apiError('未対応のプリンター方式です', 409)
      }

      try {
        const result = await sendEpsonPrintProbe({
          endpoint: receiptSettings.receipt_printer_endpoint ?? '',
          storeName: store.store_name,
          printerLabel: receiptSettings.receipt_printer_label,
        })

        return {
          printer_provider: 'epson_epos',
          printer_endpoint: receiptSettings.receipt_printer_endpoint ?? '',
          printer_label: receiptSettings.receipt_printer_label,
          result,
        }
      } catch (error) {
        if (error instanceof EpsonEposPrintError) {
          return toProbeErrorResponse(error)
        }
        throw error
      }
    }
  )
}
