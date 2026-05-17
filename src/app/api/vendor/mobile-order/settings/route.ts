import { NextRequest } from 'next/server'
import { apiError, apiOk } from '@/lib/api-response'
import { ensureVendorStoreResources } from '@/lib/mobile-order'
import {
  applyStorePosSettingsToStore,
  normalizeStorePosPaymentMethods,
  upsertStorePosSettingsInNotes,
} from '@/lib/store-pos-settings'
import {
  requireVendorMobileOrderRouteContext,
  toVendorMobileOrderRouteError,
} from '@/lib/vendor-mobile-order-route'
import type {
  VendorStorePosSettingsPayload,
  VendorStorePosSettingsUpdatePayload,
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
    message.includes('schema cache') ||
    message.includes('column')
  )
}

export async function PATCH(req: NextRequest) {
  const resolved = await requireVendorMobileOrderRouteContext(req)
  if (resolved.response) return resolved.response
  const { supabase, user } = resolved.context

  try {
    const body = (await req.json()) as Partial<VendorStorePosSettingsUpdatePayload>
    const isStorePosEnabled = body.is_store_pos_enabled !== false
    const storePosTerminalName = normalizeNullableText(body.store_pos_terminal_name) ?? 'front-tablet'
    const enabledPaymentMethods = normalizeStorePosPaymentMethods(body.store_pos_enabled_payment_methods)

    if (enabledPaymentMethods.length === 0) {
      return apiError('支払方法を1つ以上選択してください', 400)
    }

    const { data: vendorProfile } = await (supabase as any)
      .from('vendor_profiles')
      .select('business_name')
      .eq('user_id', user.id)
      .maybeSingle()

    const { store, orderPage } = await ensureVendorStoreResources(supabase, user, {
      businessName: vendorProfile?.business_name ?? null,
    })

    const nextSettings = {
      is_store_pos_enabled: isStorePosEnabled,
      store_pos_terminal_name: storePosTerminalName,
      store_pos_enabled_payment_methods: enabledPaymentMethods,
    }

    let persistence: VendorStorePosSettingsPayload['persistence'] = 'hybrid'

    const nextNotes = upsertStorePosSettingsInNotes(orderPage.notes ?? null, nextSettings)
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

    const payload: VendorStorePosSettingsPayload = {
      store: applyStorePosSettingsToStore(updatedStore, updatedOrderPage),
      orderPage: updatedOrderPage,
      persistence,
    }

    return apiOk(payload)
  } catch (error) {
    return toVendorMobileOrderRouteError('[vendor/mobile-order/settings PATCH]', error, {
      badRequest: ['支払方法を1つ以上選択してください'],
    })
  }
}
