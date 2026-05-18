import { NextRequest } from 'next/server'
import { apiError, apiOk } from '@/lib/api-response'
import { ensureVendorStoreResources } from '@/lib/mobile-order'
import {
  applyReceiptPrintSettingsToStore,
  resolveReceiptPrintSettings,
  upsertReceiptPrintSettingsInNotes,
} from '@/lib/receipt-print-settings'
import {
  applyStorePosSettingsToStore,
  normalizeStorePosPaymentMethods,
  resolveStorePosSettings,
  upsertStorePosSettingsInNotes,
} from '@/lib/store-pos-settings'
import {
  executeVendorMobileOrderJsonRoute,
} from '@/lib/vendor-mobile-order-route'
import type {
  VendorMobileOrderSettingsPayload,
  VendorMobileOrderSettingsUpdatePayload,
  ReceiptPrintMode,
  ReceiptPrinterProvider,
} from '@/types/api-payloads'

function normalizeNullableText(value: unknown) {
  if (value == null) return null
  const text = String(value).trim()
  return text || null
}

function isMissingStorePosColumnError(error: unknown) {
  const message = String((error as { message?: string } | null)?.message ?? '')
  return (
    message.includes('is_store_pos_enabled') ||
    message.includes('store_pos_terminal_name') ||
    message.includes('store_pos_enabled_payment_methods') ||
    message.includes('is_receipt_print_enabled') ||
    message.includes('receipt_printer_provider') ||
    message.includes('receipt_printer_endpoint') ||
    message.includes('receipt_printer_label') ||
    message.includes('receipt_print_mode') ||
    message.includes('schema cache') ||
    message.includes('column')
  )
}

function normalizeReceiptPrinterProvider(value: unknown): ReceiptPrinterProvider | null {
  return value === 'epson_epos' ? 'epson_epos' : null
}

function normalizeReceiptPrintMode(value: unknown): ReceiptPrintMode | null {
  return value === 'manual_dashboard' ? 'manual_dashboard' : null
}

export async function PATCH(req: NextRequest) {
  return executeVendorMobileOrderJsonRoute<VendorMobileOrderSettingsUpdatePayload, VendorMobileOrderSettingsPayload>(
    req,
    '[vendor/mobile-order/settings PATCH]',
    async ({ supabase, user }, body) => {
      const { data: vendorProfile } = await (supabase as any)
        .from('vendor_profiles')
        .select('business_name')
        .eq('user_id', user.id)
        .maybeSingle()

      const { store, orderPage } = await ensureVendorStoreResources(supabase, user, {
        businessName: vendorProfile?.business_name ?? null,
      })

      const currentStorePosSettings = resolveStorePosSettings(store, orderPage)
      const currentReceiptSettings = resolveReceiptPrintSettings(store, orderPage)

      const isStorePosEnabled =
        body.is_store_pos_enabled === undefined
          ? currentStorePosSettings.is_store_pos_enabled
          : body.is_store_pos_enabled !== false
      const storePosTerminalName =
        body.store_pos_terminal_name === undefined
          ? currentStorePosSettings.store_pos_terminal_name
          : normalizeNullableText(body.store_pos_terminal_name) ?? 'front-tablet'
      const enabledPaymentMethods =
        body.store_pos_enabled_payment_methods === undefined
          ? currentStorePosSettings.store_pos_enabled_payment_methods
          : normalizeStorePosPaymentMethods(body.store_pos_enabled_payment_methods)

      if (enabledPaymentMethods.length === 0) {
        return apiError('支払方法を1つ以上選択してください', 400)
      }

      const isReceiptPrintEnabled =
        body.is_receipt_print_enabled === undefined
          ? currentReceiptSettings.is_receipt_print_enabled
          : body.is_receipt_print_enabled === true
      const receiptPrinterProvider =
        body.receipt_printer_provider === undefined
          ? currentReceiptSettings.receipt_printer_provider
          : normalizeReceiptPrinterProvider(body.receipt_printer_provider) ?? 'epson_epos'
      const receiptPrinterEndpoint =
        body.receipt_printer_endpoint === undefined
          ? currentReceiptSettings.receipt_printer_endpoint
          : normalizeNullableText(body.receipt_printer_endpoint)
      const receiptPrinterLabel =
        body.receipt_printer_label === undefined
          ? currentReceiptSettings.receipt_printer_label
          : normalizeNullableText(body.receipt_printer_label) ?? 'kitchen-printer'
      const receiptPrintMode =
        body.receipt_print_mode === undefined
          ? currentReceiptSettings.receipt_print_mode
          : normalizeReceiptPrintMode(body.receipt_print_mode) ?? 'manual_dashboard'

      if (isReceiptPrintEnabled && !receiptPrinterEndpoint) {
        return apiError('レシート印刷を有効にする場合は、プリンター接続先を入力してください', 400)
      }

      const nextStorePosSettings = {
        is_store_pos_enabled: isStorePosEnabled,
        store_pos_terminal_name: storePosTerminalName,
        store_pos_enabled_payment_methods: enabledPaymentMethods,
      }

      const nextReceiptSettings = {
        is_receipt_print_enabled: isReceiptPrintEnabled,
        receipt_printer_provider: receiptPrinterProvider,
        receipt_printer_endpoint: receiptPrinterEndpoint,
        receipt_printer_label: receiptPrinterLabel,
        receipt_print_mode: receiptPrintMode,
      }

      let persistence: VendorMobileOrderSettingsPayload['persistence'] = 'hybrid'

      const nextNotes = upsertReceiptPrintSettingsInNotes(
        upsertStorePosSettingsInNotes(orderPage.notes ?? null, nextStorePosSettings),
        nextReceiptSettings
      )
      const { data: updatedOrderPage, error: orderPageError } = await (supabase as any)
        .from('store_order_pages')
        .update({ notes: nextNotes })
        .eq('id', orderPage.id)
        .select('*')
        .single()

      if (orderPageError) {
        return apiError(orderPageError.message)
      }

      let updatedStore = store
      const { data: vendorStoreData, error: vendorStoreError } = await (supabase as any)
        .from('vendor_stores')
        .update({
          is_store_pos_enabled: isStorePosEnabled,
          store_pos_terminal_name: storePosTerminalName,
          store_pos_enabled_payment_methods: enabledPaymentMethods,
          is_receipt_print_enabled: isReceiptPrintEnabled,
          receipt_printer_provider: receiptPrinterProvider,
          receipt_printer_endpoint: receiptPrinterEndpoint,
          receipt_printer_label: receiptPrinterLabel,
          receipt_print_mode: receiptPrintMode,
        })
        .eq('id', store.id)
        .select('*')
        .single()

      if (vendorStoreError) {
        if (isMissingStorePosColumnError(vendorStoreError)) {
          persistence = 'notes_fallback'
        } else {
          return apiError(vendorStoreError.message)
        }
      } else if (vendorStoreData) {
        updatedStore = vendorStoreData
      }

      const payload: VendorMobileOrderSettingsPayload = {
        store: applyReceiptPrintSettingsToStore(applyStorePosSettingsToStore(updatedStore, updatedOrderPage), updatedOrderPage),
        orderPage: updatedOrderPage,
        persistence,
      }

      return payload
    },
    {
      badRequest: [
        '支払方法を1つ以上選択してください',
        'レシート印刷を有効にする場合は、プリンター接続先を入力してください',
      ],
    }
  )
}
