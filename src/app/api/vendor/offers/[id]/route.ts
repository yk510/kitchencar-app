import { NextRequest, NextResponse } from 'next/server'
import { requireRouteSession } from '@/lib/auth'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireRouteSession(req)
  if (auth.response) return auth.response
  const { supabase, user, role } = auth.session

  if (role !== 'vendor') {
    return NextResponse.json({ error: '事業者向けの画面です' }, { status: 403 })
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
    return NextResponse.json({ error: '募集が見つかりません' }, { status: 404 })
  }

  const { data: organizer } = await (supabase as any)
    .rpc('get_organizer_public_profile', { target_user_id: offer.user_id })
    .maybeSingle()

  return NextResponse.json({
    data: {
      ...offer,
      organizer_name: organizer?.organizer_name ?? '主催者',
      organizer_contact_name: organizer?.contact_name ?? null,
      organizer_logo_image_url: organizer?.logo_image_url ?? null,
      organizer_instagram_url: organizer?.instagram_url ?? null,
      organizer_x_url: organizer?.x_url ?? null,
      organizer_description: organizer?.description ?? null,
      my_application: application ?? null,
    },
  })
}
