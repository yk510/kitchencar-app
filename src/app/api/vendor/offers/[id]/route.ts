import { NextRequest } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import { getOrganizerPublicProfile } from '@/lib/public-profiles'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireRouteSession(req)
  if (auth.response) return auth.response
  const { supabase, user, role } = auth.session

  if (role !== 'vendor') {
    return apiError('事業者向けの画面です', 403)
  }

  const [{ data: offer, error: offerError }, { data: application }] = await Promise.all([
    (supabase as any)
      .from('event_offers')
      .select('*')
      .eq('id', params.id)
      .eq('is_public', true)
      .maybeSingle(),
    (supabase as any)
      .from('event_applications')
      .select('id, status, last_message_at, initial_message')
      .eq('offer_id', params.id)
      .eq('vendor_user_id', user.id)
      .maybeSingle(),
  ])

  if (offerError || !offer) {
    return apiError('募集が見つかりません', 404)
  }

  const organizer = await getOrganizerPublicProfile(supabase as any, offer.user_id)

  return apiOk({
    ...offer,
    organizer_name: organizer?.organizer_name ?? '主催者',
    organizer_contact_name: organizer?.contact_name ?? null,
    organizer_logo_image_url: organizer?.logo_image_url ?? null,
    organizer_instagram_url: organizer?.instagram_url ?? null,
    organizer_x_url: organizer?.x_url ?? null,
    organizer_description: organizer?.description ?? null,
    my_application: application ?? null,
  })
}
