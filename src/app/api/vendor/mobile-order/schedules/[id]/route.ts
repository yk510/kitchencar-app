import { NextRequest } from 'next/server'
import { apiError } from '@/lib/api-response'
import {
  extractStoreOrderScheduleMetadata,
  upsertStoreOrderScheduleMetadataInNotes,
} from '@/lib/store-order-schedule-metadata'
import {
  executeVendorMobileOrderJsonRoute,
} from '@/lib/vendor-mobile-order-route'
import type { VendorMobileOrderScheduleMutationPayload } from '@/types/api-payloads'

function parseOptionalIsoDatetime(value: unknown) {
  if (value == null || value === '') return undefined
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  return executeVendorMobileOrderJsonRoute<Record<string, unknown>, VendorMobileOrderScheduleMutationPayload>(
    req,
    '[vendor/mobile-order/schedules/:id PATCH]',
    async ({ supabase, user }, body) => {

    const { data: current, error: fetchError } = await (supabase as any)
      .from('store_order_schedules')
      .select('*, vendor_stores!inner(vendor_user_id)')
      .eq('id', id)
      .eq('vendor_stores.vendor_user_id', user.id)
      .single()

    if (fetchError || !current) {
      return apiError('対象の営業枠が見つかりません', 404)
    }

    const nextBusinessDate =
      typeof body.business_date === 'string' ? body.business_date.trim() : current.business_date
    const nextOpensAt = parseOptionalIsoDatetime(body.opens_at) ?? current.opens_at
    const nextClosesAt = parseOptionalIsoDatetime(body.closes_at) ?? current.closes_at
    const nextStatus =
      typeof body.status === 'string' && body.status.trim()
        ? body.status.trim()
        : current.status
    const nextLocationId =
      typeof body.location_id === 'string' ? body.location_id.trim() : undefined
    const nextEventName =
      typeof body.event_name === 'string'
        ? body.event_name.trim() || null
        : body.event_name === null
          ? null
          : undefined
    const nextNotes =
      typeof body.notes === 'string'
        ? body.notes.trim() || null
        : body.notes === null
          ? null
          : current.notes
    const currentMetadata = extractStoreOrderScheduleMetadata(current.notes)

    if (!['scheduled', 'open', 'closed', 'cancelled'].includes(nextStatus)) {
      return apiError('不正なステータスです', 400)
    }
    if (nextLocationId !== undefined && !nextLocationId) {
      return apiError('出店場所は必須です', 400)
    }

    if (new Date(nextOpensAt).getTime() >= new Date(nextClosesAt).getTime()) {
      return apiError('終了日時は開始日時より後にしてください', 400)
    }

    const finalLocationId = nextLocationId !== undefined ? nextLocationId : currentMetadata.location_id
    const finalEventName = nextEventName !== undefined ? nextEventName : currentMetadata.event_name
    if (finalLocationId) {
      const { data: location, error: locationError } = await (supabase as any)
        .from('locations')
        .select('id')
        .eq('id', finalLocationId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (locationError) {
        return apiError(locationError.message)
      }
      if (!location) {
        return apiError('出店場所が見つかりません', 400)
      }
    }

    const metadataNotes = upsertStoreOrderScheduleMetadataInNotes(nextNotes, {
      location_id: finalLocationId ?? null,
      event_name: finalEventName ?? null,
    })

    const { data, error } = await (supabase as any)
      .from('store_order_schedules')
      .update({
        business_date: nextBusinessDate,
        opens_at: nextOpensAt,
        closes_at: nextClosesAt,
        status: nextStatus,
        notes: metadataNotes,
      })
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      return apiError(error.message)
    }

      const payload: VendorMobileOrderScheduleMutationPayload = data
      return payload
    },
    {
      badRequest: [
        '不正なステータスです',
        '出店場所は必須です',
        '終了日時は開始日時より後にしてください',
        '出店場所が見つかりません',
      ],
      notFound: ['対象の営業枠が見つかりません'],
    }
  )
}
