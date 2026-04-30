import { NextRequest } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
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
  const auth = await requireRouteSession(req)
  if (auth.response) return auth.response

  if (auth.session.role !== 'vendor') {
    return apiError('ベンダー権限が必要です', 403)
  }

  const { id } = await context.params
  const { supabase, user } = auth.session

  try {
    const body = await req.json()

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
    const nextNotes =
      typeof body.notes === 'string'
        ? body.notes.trim() || null
        : body.notes === null
          ? null
          : current.notes

    if (!['scheduled', 'open', 'closed', 'cancelled'].includes(nextStatus)) {
      return apiError('不正なステータスです', 400)
    }

    if (new Date(nextOpensAt).getTime() >= new Date(nextClosesAt).getTime()) {
      return apiError('終了日時は開始日時より後にしてください', 400)
    }

    const { data, error } = await (supabase as any)
      .from('store_order_schedules')
      .update({
        business_date: nextBusinessDate,
        opens_at: nextOpensAt,
        closes_at: nextClosesAt,
        status: nextStatus,
        notes: nextNotes,
      })
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      return apiError(error.message)
    }

    const payload: VendorMobileOrderScheduleMutationPayload = data
    return apiOk(payload)
  } catch (error) {
    console.error('[vendor/mobile-order/schedules/:id PATCH]', error)
    return apiError('サーバーエラー')
  }
}
