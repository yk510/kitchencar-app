import { NextRequest } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import { ensureVendorStoreResources } from '@/lib/mobile-order'
import {
  applyMetadataToSchedule,
  upsertStoreOrderScheduleMetadataInNotes,
} from '@/lib/store-order-schedule-metadata'
import { applyStorePosSettingsToStore } from '@/lib/store-pos-settings'
import type {
  VendorMobileOrderScheduleMutationPayload,
  VendorMobileOrderSchedulesPayload,
} from '@/types/api-payloads'

function parseIsoDatetime(value: unknown) {
  const text = String(value ?? '').trim()
  if (!text) return null
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export async function GET(req: NextRequest) {
  const auth = await requireRouteSession(req)
  if (auth.response) return auth.response

  if (auth.session.role !== 'vendor') {
    return apiError('ベンダー権限が必要です', 403)
  }

  const { supabase, user } = auth.session

  const { data: vendorProfile } = await (supabase as any)
    .from('vendor_profiles')
    .select('business_name')
    .eq('user_id', user.id)
    .maybeSingle()

  try {
    const { store, orderPage } = await ensureVendorStoreResources(supabase, user, {
      businessName: vendorProfile?.business_name ?? null,
    })

    const { data: schedules, error } = await (supabase as any)
      .from('store_order_schedules')
      .select('*')
      .eq('store_id', store.id)
      .order('business_date', { ascending: true })
      .order('opens_at', { ascending: true })

    const { data: locations, error: locationsError } = await (supabase as any)
      .from('locations')
      .select('id, name, address')
      .eq('user_id', user.id)
      .order('name', { ascending: true })

    if (error) {
      return apiError(error.message)
    }
    if (locationsError) {
      return apiError(locationsError.message)
    }

    const payload: VendorMobileOrderSchedulesPayload = {
      store: applyStorePosSettingsToStore(store, orderPage),
      orderPage,
      schedules: ((schedules ?? []) as any[]).map((schedule) => applyMetadataToSchedule(schedule)),
      locations: (locations ?? []) as any[],
    }

    return apiOk(payload)
  } catch (error) {
    console.error('[vendor/mobile-order/schedules GET]', error)
    return apiError(error instanceof Error ? error.message : 'サーバーエラー')
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRouteSession(req)
  if (auth.response) return auth.response

  if (auth.session.role !== 'vendor') {
    return apiError('ベンダー権限が必要です', 403)
  }

  const { supabase, user } = auth.session

  try {
    const body = await req.json()
    const businessDate = String(body.business_date ?? '').trim()
    const opensAt = parseIsoDatetime(body.opens_at)
    const closesAt = parseIsoDatetime(body.closes_at)
    const notes = String(body.notes ?? '').trim() || null
    const locationId = String(body.location_id ?? '').trim()
    const eventName = String(body.event_name ?? '').trim() || null

    if (!businessDate || !opensAt || !closesAt) {
      return apiError('営業日と受付開始・終了日時は必須です', 400)
    }
    if (!locationId) {
      return apiError('出店場所は必須です', 400)
    }

    if (new Date(opensAt).getTime() >= new Date(closesAt).getTime()) {
      return apiError('終了日時は開始日時より後にしてください', 400)
    }

    const { data: vendorProfile } = await (supabase as any)
      .from('vendor_profiles')
      .select('business_name')
      .eq('user_id', user.id)
      .maybeSingle()

    const { store, orderPage } = await ensureVendorStoreResources(supabase, user, {
      businessName: vendorProfile?.business_name ?? null,
    })

    const { data: location, error: locationError } = await (supabase as any)
      .from('locations')
      .select('id')
      .eq('id', locationId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (locationError) {
      return apiError(locationError.message)
    }
    if (!location) {
      return apiError('出店場所が見つかりません', 400)
    }

    const scheduleNotes = upsertStoreOrderScheduleMetadataInNotes(notes, {
      location_id: locationId,
      event_name: eventName,
    })

    const { data, error } = await (supabase as any)
      .from('store_order_schedules')
      .insert([
        {
          store_id: store.id,
          order_page_id: orderPage.id,
          business_date: businessDate,
          opens_at: opensAt,
          closes_at: closesAt,
          status: 'scheduled',
          notes: scheduleNotes,
        },
      ])
      .select('*')
      .single()

    if (error) {
      return apiError(error.message)
    }

    const payload: VendorMobileOrderScheduleMutationPayload = data
    return apiOk(payload)
  } catch (error) {
    console.error('[vendor/mobile-order/schedules POST]', error)
    return apiError('サーバーエラー')
  }
}
