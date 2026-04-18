import { NextRequest, NextResponse } from 'next/server'
import { requireRouteSession } from '@/lib/auth'

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
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const offerIds = Array.from(new Set((applications ?? []).map((row: any) => row.offer_id)))
  const organizerIds =
    role === 'vendor'
      ? Array.from(new Set((applications ?? []).map((row: any) => row.organizer_user_id)))
      : []

  const vendorIds =
    role === 'organizer'
      ? Array.from(new Set((applications ?? []).map((row: any) => row.vendor_user_id)))
      : []

  const [offersResult, organizersResult, vendorsResult, unreadResult] = await Promise.all([
    offerIds.length > 0
      ? (supabase as any)
          .from('event_offers')
          .select('id, title, event_date, event_end_date, venue_name, municipality, status')
          .in('id', offerIds)
      : Promise.resolve({ data: [], error: null }),
    organizerIds.length > 0
      ? (supabase as any)
          .from('organizer_profiles')
          .select('user_id, organizer_name')
          .in('user_id', organizerIds)
      : Promise.resolve({ data: [], error: null }),
    vendorIds.length > 0
      ? Promise.all(
          vendorIds.map(async (vendorId) => {
            const { data } = await (supabase as any)
              .rpc('get_vendor_public_profile', { target_user_id: vendorId })
              .maybeSingle()

            return data ? { user_id: vendorId, ...data } : null
          })
        )
      : Promise.resolve([]),
    offerIds.length > 0 || (applications ?? []).length > 0
      ? (supabase as any)
          .from('application_messages')
          .select('id, application_id, read_by_vendor_at, read_by_organizer_at, sender_role')
          .in(
            'application_id',
            (applications ?? []).map((row: any) => row.id)
          )
      : Promise.resolve({ data: [], error: null }),
  ])

  const unreadRows = (unreadResult.data ?? []) as any[]
  const unreadMap = new Map<string, number>()
  for (const row of unreadRows) {
    const unread =
      role === 'organizer'
        ? row.sender_role === 'vendor' && !row.read_by_organizer_at
        : row.sender_role === 'organizer' && !row.read_by_vendor_at
    if (!unread) continue
    unreadMap.set(row.application_id, (unreadMap.get(row.application_id) ?? 0) + 1)
  }

  const offerMap = new Map<string, any>((offersResult.data ?? []).map((row: any) => [row.id, row]))
  const organizerMap = new Map<string, any>((organizersResult.data ?? []).map((row: any) => [row.user_id, row]))
  const vendorMap = new Map<string, any>((vendorsResult ?? []).filter(Boolean).map((row: any) => [row.user_id, row]))

  const data = (applications ?? []).map((application: any) => ({
    ...application,
    offer: offerMap.get(application.offer_id) ?? null,
    organizer_name:
      role === 'vendor'
        ? organizerMap.get(application.organizer_user_id)?.organizer_name ?? '主催者'
        : null,
    vendor_name:
      role === 'organizer'
        ? vendorMap.get(application.vendor_user_id)?.business_name ?? application.vendor_business_name
        : null,
    vendor_business_name:
      role === 'organizer'
        ? vendorMap.get(application.vendor_user_id)?.business_name ?? application.vendor_business_name
        : application.vendor_business_name,
    vendor_contact_name:
      role === 'organizer'
        ? vendorMap.get(application.vendor_user_id)?.owner_name ?? application.vendor_contact_name
        : application.vendor_contact_name,
    vendor_contact_email:
      role === 'organizer'
        ? vendorMap.get(application.vendor_user_id)?.contact_email ?? application.vendor_contact_email
        : application.vendor_contact_email,
    vendor_phone:
      role === 'organizer'
        ? vendorMap.get(application.vendor_user_id)?.phone ?? application.vendor_phone
        : application.vendor_phone,
    unread_count: unreadMap.get(application.id) ?? 0,
  }))

  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRouteSession(req)
    if (auth.response) return auth.response
    const { supabase, user, role } = auth.session

    if (role !== 'vendor') {
      return NextResponse.json({ error: '事業者のみ応募できます' }, { status: 403 })
    }

    const body = await req.json()
    const offerId = String(body.offer_id ?? '').trim()
    const initialMessage = String(body.message ?? '').trim() || null
    const mode = body.mode === 'inquiry' ? 'inquiry' : 'application'

    if (!offerId) {
      return NextResponse.json({ error: '募集が選択されていません' }, { status: 400 })
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
      return NextResponse.json({ error: '募集が見つかりません' }, { status: 404 })
    }

    if (offer.status !== 'open' || !offer.is_public) {
      return NextResponse.json({ error: '現在は応募できない募集です' }, { status: 400 })
    }

    if (!vendorProfile?.business_name) {
      return NextResponse.json({ error: '先に事業者設定を入力してください' }, { status: 400 })
    }

    const { data: existing } = await (supabase as any)
      .from('event_applications')
      .select('*')
      .eq('offer_id', offer.id)
      .eq('vendor_user_id', user.id)
      .maybeSingle()

    if (existing?.status && mode === 'application' && existing.status !== 'inquiry') {
      return NextResponse.json({ error: 'この募集にはすでに応募しています' }, { status: 400 })
    }

    if (existing?.status === 'inquiry' && mode === 'inquiry') {
      return NextResponse.json({ error: 'この募集にはすでに質問スレッドがあります' }, { status: 400 })
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
      return NextResponse.json({ error: applicationError.message }, { status: 500 })
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
        return NextResponse.json({ error: messageError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ data: application })
  } catch (error) {
    console.error('[event-applications POST]', error)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
