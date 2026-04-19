import { NextRequest } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import { buildApplicationRows } from '@/lib/application-view'
import type {
  ApplicationCreatePayload,
  OrganizerApplicationsPayload,
  VendorApplicationsPayload,
} from '@/types/api-payloads'

export async function GET(req: NextRequest) {
  const auth = await requireRouteSession(req)
  if (auth.response) return auth.response
  const { supabase, user, role } = auth.session

  const baseQuery = (supabase as any)
    .from('event_applications')
    .select('*')
    .order('last_message_at', { ascending: false })

  const { data: applications, error } =
    role === 'organizer'
      ? await baseQuery.eq('organizer_user_id', user.id)
      : await baseQuery.eq('vendor_user_id', user.id)

  if (error) {
    return apiError(error.message)
  }

  const data = await buildApplicationRows(supabase as any, applications ?? [], role)
  const payload: OrganizerApplicationsPayload | VendorApplicationsPayload = data

  return apiOk(payload)
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRouteSession(req)
    if (auth.response) return auth.response
    const { supabase, user, role } = auth.session

    if (role !== 'vendor') {
      return apiError('事業者のみ応募できます', 403)
    }

    const body = await req.json()
    const offerId = String(body.offer_id ?? '').trim()
    const initialMessage = String(body.message ?? '').trim() || null
    const mode = body.mode === 'inquiry' ? 'inquiry' : 'application'

    if (!offerId) {
      return apiError('募集が選択されていません', 400)
    }

    const [{ data: offer, error: offerError }, { data: vendorProfile }] = await Promise.all([
      (supabase as any)
        .from('event_offers')
        .select('id, user_id, title, status, is_public')
        .eq('id', offerId)
        .maybeSingle(),
      (supabase as any)
        .from('vendor_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle(),
    ])

    if (offerError || !offer) {
      return apiError('募集が見つかりません', 404)
    }

    if (offer.status !== 'open' || !offer.is_public) {
      return apiError('現在は応募できない募集です', 400)
    }

    if (!vendorProfile?.business_name) {
      return apiError('先に事業者設定を入力してください', 400)
    }

    const { data: existing } = await (supabase as any)
      .from('event_applications')
      .select('*')
      .eq('offer_id', offer.id)
      .eq('vendor_user_id', user.id)
      .maybeSingle()

    if (existing?.status && mode === 'application' && existing.status !== 'inquiry') {
      return apiError('この募集にはすでに応募しています', 400)
    }

    if (existing?.status === 'inquiry' && mode === 'inquiry') {
      return apiError('この募集にはすでに質問スレッドがあります', 400)
    }

    const applicationPayload = {
      offer_id: offer.id,
      organizer_user_id: offer.user_id,
      vendor_user_id: user.id,
      vendor_profile_id: vendorProfile.user_id,
      vendor_business_name: vendorProfile.business_name,
      vendor_contact_name: vendorProfile.owner_name,
      vendor_contact_email: vendorProfile.contact_email,
      vendor_phone: vendorProfile.phone,
      initial_message: initialMessage,
      status: mode === 'inquiry' ? 'inquiry' : 'pending',
      last_message_at: new Date().toISOString(),
      contact_released_at: null,
    }

    const { data: application, error: applicationError } = existing?.status === 'inquiry' && mode === 'application'
      ? await (supabase as any)
          .from('event_applications')
          .update({
            ...applicationPayload,
            initial_message: existing.initial_message ?? initialMessage,
            status: 'pending',
          })
          .eq('id', existing.id)
          .select()
          .single()
      : await (supabase as any)
          .from('event_applications')
          .insert([applicationPayload])
          .select()
          .single()

    if (applicationError) {
      return apiError(applicationError.message)
    }

    if (initialMessage) {
      const { error: messageError } = await (supabase as any)
        .from('application_messages')
        .insert([
          {
            application_id: application.id,
            sender_user_id: user.id,
            sender_role: 'vendor',
            message: initialMessage,
            read_by_vendor_at: new Date().toISOString(),
            read_by_organizer_at: null,
          },
        ])

      if (messageError) {
        return apiError(messageError.message)
      }
    }

    const payload: ApplicationCreatePayload = application
    return apiOk(payload)
  } catch (error) {
    console.error('[event-applications POST]', error)
    return apiError('サーバーエラー')
  }
}
