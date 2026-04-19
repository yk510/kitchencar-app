import { NextRequest, NextResponse } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import { getOrganizerPublicProfiles } from '@/lib/public-profiles'

export async function GET(req: NextRequest) {
  const auth = await requireRouteSession(req)
  if (auth.response) return auth.response
  const { supabase, user, role } = auth.session

  if (role !== 'vendor') {
    return apiError('事業者向けの画面です', 403)
  }

  const [{ data: offers, error: offersError }, { data: applications, error: applicationsError }] = await Promise.all([
    (supabase as any)
      .from('event_offers')
      .select('id, user_id, title, event_date, event_end_date, venue_name, venue_address, municipality, recruitment_count, stall_fee, application_deadline, load_in_start_time, load_in_end_time, sales_start_time, sales_end_time, load_out_start_time, load_out_end_time, provided_facilities, required_equipment, notes, status, is_public, created_at')
      .eq('is_public', true)
      .eq('status', 'open')
      .order('event_date', { ascending: true }),
    (supabase as any)
      .from('event_applications')
      .select('id, offer_id, status, last_message_at')
      .eq('vendor_user_id', user.id),
  ])

  if (offersError || applicationsError) {
    return apiError(offersError?.message ?? applicationsError?.message ?? '募集一覧の取得に失敗しました')
  }

  const organizerIds: string[] = Array.from(
    new Set((offers ?? []).map((offer: any) => offer.user_id).filter((userId: unknown): userId is string => typeof userId === 'string' && userId.length > 0))
  )
  const organizerMap = await getOrganizerPublicProfiles(supabase as any, organizerIds)
  const applicationMap = new Map<string, any>((applications ?? []).map((row: any) => [row.offer_id, row]))

  const data = (offers ?? []).map((offer: any) => ({
    ...offer,
    organizer_name: organizerMap.get(offer.user_id)?.organizer_name ?? '主催者',
    organizer_contact_name: organizerMap.get(offer.user_id)?.contact_name ?? null,
    my_application: applicationMap.get(offer.id) ?? null,
  }))

  return apiOk(data)
}
