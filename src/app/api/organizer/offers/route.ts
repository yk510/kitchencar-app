import { NextRequest, NextResponse } from 'next/server'
import { requireRouteSession } from '@/lib/auth'

function normalizeOfferBody(body: any) {
  const title = String(body.title ?? '').trim()
  const event_date = String(body.event_date ?? '').trim()
  const event_end_date = String(body.event_end_date ?? '').trim() || null
  const venue_name = String(body.venue_name ?? '').trim()
  const venue_address = String(body.venue_address ?? '').trim() || null
  const municipality = String(body.municipality ?? '').trim() || null
  const recruitment_count = Math.max(1, Number(body.recruitment_count ?? 1) || 1)
  const fee_type =
    body.fee_type === 'revenue_share' ||
    body.fee_type === 'fixed_plus_revenue_share' ||
    body.fee_type === 'free'
      ? body.fee_type
      : 'fixed'
  const stall_fee =
    fee_type === 'fixed' || fee_type === 'fixed_plus_revenue_share'
      ? body.stall_fee === '' || body.stall_fee == null
        ? null
        : Number(body.stall_fee)
      : null
  const revenue_share_rate =
    fee_type === 'revenue_share' || fee_type === 'fixed_plus_revenue_share'
      ? body.revenue_share_rate === '' || body.revenue_share_rate == null
        ? null
        : Number(body.revenue_share_rate)
      : null
  const application_deadline = String(body.application_deadline ?? '').trim() || null
  const load_in_start_time = String(body.load_in_start_time ?? '').trim() || null
  const load_in_end_time = String(body.load_in_end_time ?? '').trim() || null
  const sales_start_time = String(body.sales_start_time ?? '').trim() || null
  const sales_end_time = String(body.sales_end_time ?? '').trim() || null
  const load_out_start_time = String(body.load_out_start_time ?? '').trim() || null
  const load_out_end_time = String(body.load_out_end_time ?? '').trim() || null
  const provided_facilities = Array.isArray(body.provided_facilities)
    ? body.provided_facilities.filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0)
    : []
  const photo_urls = Array.isArray(body.photo_urls)
    ? body.photo_urls.filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0).slice(0, 10)
    : []
  const venue_features = String(body.venue_features ?? '').trim() || null
  const recruitment_purpose = String(body.recruitment_purpose ?? '').trim() || null
  const required_equipment = String(body.required_equipment ?? '').trim() || null
  const notes = String(body.notes ?? '').trim() || null
  const status = body.status === 'closed' ? 'closed' : body.status === 'open' ? 'open' : 'draft'
  const is_public = body.is_public !== false

  return {
    title,
    event_date,
    event_end_date,
    venue_name,
    venue_address,
    municipality,
    recruitment_count,
    fee_type,
    stall_fee,
    revenue_share_rate,
    application_deadline,
    load_in_start_time,
    load_in_end_time,
    sales_start_time,
    sales_end_time,
    load_out_start_time,
    load_out_end_time,
    provided_facilities,
    photo_urls,
    venue_features,
    recruitment_purpose,
    required_equipment,
    notes,
    status,
    is_public,
  }
}

function validateOfferPayload(payload: ReturnType<typeof normalizeOfferBody>) {
  if (!payload.title || !payload.event_date || !payload.venue_name) {
    return '募集名、開催日、開催場所は必須です'
  }
  if ((payload.fee_type === 'fixed' || payload.fee_type === 'fixed_plus_revenue_share') && !Number.isFinite(payload.stall_fee)) {
    return '固定出店料を入力してください'
  }
  if ((payload.fee_type === 'revenue_share' || payload.fee_type === 'fixed_plus_revenue_share') && !Number.isFinite(payload.revenue_share_rate)) {
    return '売上歩合のパーセンテージを入力してください'
  }
  if (payload.photo_urls.length === 0) {
    return '募集写真を1枚以上登録してください'
  }
  if (!payload.venue_features || !payload.recruitment_purpose) {
    return 'イベントや会場の特徴、募集背景・目的を入力してください'
  }
  return null
}

function summarizeOfferChanges(previous: any, next: ReturnType<typeof normalizeOfferBody>) {
  const labels: string[] = []

  if (previous.title !== next.title) labels.push('募集名')
  if (previous.event_date !== next.event_date || (previous.event_end_date ?? null) !== next.event_end_date) labels.push('開催日程')
  if (previous.venue_name !== next.venue_name || (previous.venue_address ?? null) !== next.venue_address || (previous.municipality ?? null) !== next.municipality) labels.push('開催場所')
  if (previous.recruitment_count !== next.recruitment_count) labels.push('募集台数')
  if (previous.fee_type !== next.fee_type || (previous.stall_fee ?? null) !== next.stall_fee || (previous.revenue_share_rate ?? null) !== next.revenue_share_rate) labels.push('出店料')
  if ((previous.application_deadline ?? null) !== next.application_deadline) labels.push('募集締切')
  if (
    (previous.load_in_start_time ?? null) !== next.load_in_start_time ||
    (previous.load_in_end_time ?? null) !== next.load_in_end_time ||
    (previous.sales_start_time ?? null) !== next.sales_start_time ||
    (previous.sales_end_time ?? null) !== next.sales_end_time ||
    (previous.load_out_start_time ?? null) !== next.load_out_start_time ||
    (previous.load_out_end_time ?? null) !== next.load_out_end_time
  ) labels.push('時間帯')
  if (JSON.stringify(previous.provided_facilities ?? []) !== JSON.stringify(next.provided_facilities)) labels.push('提供設備')
  if (JSON.stringify(previous.photo_urls ?? []) !== JSON.stringify(next.photo_urls)) labels.push('掲載写真')
  if ((previous.venue_features ?? null) !== next.venue_features) labels.push('イベント・会場の特徴')
  if ((previous.recruitment_purpose ?? null) !== next.recruitment_purpose) labels.push('募集背景・目的')
  if ((previous.required_equipment ?? null) !== next.required_equipment) labels.push('必要設備・条件')
  if ((previous.notes ?? null) !== next.notes) labels.push('備考')
  if (previous.status !== next.status || previous.is_public !== next.is_public) labels.push('公開状態')

  return labels
}

async function notifyOfferUpdate(supabase: any, organizerUserId: string, offerId: string, changedLabels: string[]) {
  if (changedLabels.length === 0) return

  const { data: applications, error } = await supabase
    .from('event_applications')
    .select('id')
    .eq('offer_id', offerId)
    .neq('status', 'rejected')

  if (error || !applications || applications.length === 0) {
    return
  }

  const now = new Date().toISOString()
  const message = `主催者が募集内容を更新しました。\n更新箇所: ${changedLabels.join('、')}\n\n募集詳細ページで最新情報をご確認ください。`

  const { error: insertError } = await supabase.from('application_messages').insert(
    applications.map((application: any) => ({
      application_id: application.id,
      sender_user_id: organizerUserId,
      sender_role: 'organizer',
      message,
      read_by_vendor_at: null,
      read_by_organizer_at: now,
    }))
  )

  if (!insertError) {
    await supabase
      .from('event_applications')
      .update({ last_message_at: now })
      .in('id', applications.map((application: any) => application.id))
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireRouteSession(req)
  if (auth.response) return auth.response
  const { supabase, user } = auth.session

  const { data, error } = await (supabase as any)
    .from('event_offers')
    .select('*')
    .eq('user_id', user.id)
    .order('event_date', { ascending: true })
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const offerIds = (data ?? []).map((row: any) => row.id)
  const { data: applications } =
    offerIds.length > 0
      ? await (supabase as any).from('event_applications').select('offer_id, status').in('offer_id', offerIds)
      : { data: [] }

  const countMap = new Map<string, { application_count: number; accepted_count: number }>()
  for (const row of applications ?? []) {
    const current = countMap.get(row.offer_id) ?? { application_count: 0, accepted_count: 0 }
    current.application_count += 1
    if (row.status === 'accepted') current.accepted_count += 1
    countMap.set(row.offer_id, current)
  }

  return NextResponse.json({
    data: (data ?? []).map((row: any) => ({
      ...row,
      application_count: countMap.get(row.id)?.application_count ?? 0,
      accepted_count: countMap.get(row.id)?.accepted_count ?? 0,
    })),
  })
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRouteSession(req)
    if (auth.response) return auth.response
    const { supabase, user } = auth.session

    const body = await req.json()
    const payload = normalizeOfferBody(body)
    const validationError = validateOfferPayload(payload)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const { data: profile } = await (supabase as any)
      .from('organizer_profiles')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle()

    const { data, error } = await (supabase as any)
      .from('event_offers')
      .insert([
        {
          user_id: user.id,
          organizer_profile_id: profile?.user_id ?? null,
          ...payload,
          stall_fee: Number.isFinite(payload.stall_fee) ? payload.stall_fee : null,
          revenue_share_rate: Number.isFinite(payload.revenue_share_rate) ? payload.revenue_share_rate : null,
        },
      ])
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('[organizer/offers POST]', error)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireRouteSession(req)
    if (auth.response) return auth.response
    const { supabase, user } = auth.session

    const body = await req.json()
    const id = String(body.id ?? '').trim()
    if (!id) {
      return NextResponse.json({ error: '更新対象の募集が見つかりません' }, { status: 400 })
    }

    const payload = normalizeOfferBody(body)
    const validationError = validateOfferPayload(payload)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const { data: currentOffer, error: currentOfferError } = await (supabase as any)
      .from('event_offers')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (currentOfferError || !currentOffer) {
      return NextResponse.json({ error: '募集が見つかりません' }, { status: 404 })
    }

    const { data, error } = await (supabase as any)
      .from('event_offers')
      .update({
        ...payload,
        stall_fee: Number.isFinite(payload.stall_fee) ? payload.stall_fee : null,
        revenue_share_rate: Number.isFinite(payload.revenue_share_rate) ? payload.revenue_share_rate : null,
      })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const changedLabels = summarizeOfferChanges(currentOffer, payload)
    await notifyOfferUpdate(supabase as any, user.id, id, changedLabels)

    return NextResponse.json({ data })
  } catch (error) {
    console.error('[organizer/offers PATCH]', error)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
