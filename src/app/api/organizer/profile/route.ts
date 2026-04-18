import { NextRequest, NextResponse } from 'next/server'
import { requireRouteSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = await requireRouteSession(req)
  if (auth.response) return auth.response
  const { supabase, user } = auth.session

  const { data, error } = await (supabase as any)
    .from('organizer_profiles')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRouteSession(req)
    if (auth.response) return auth.response
    const { supabase, user } = auth.session

    const body = await req.json()
    const organizer_name = String(body.organizer_name ?? '').trim()
    const contact_name = String(body.contact_name ?? '').trim() || null
    const contact_email = String(body.contact_email ?? '').trim() || user.email || null
    const phone = String(body.phone ?? '').trim() || null
    const logo_image_url = String(body.logo_image_url ?? '').trim() || null
    const instagram_url = String(body.instagram_url ?? '').trim() || null
    const x_url = String(body.x_url ?? '').trim() || null
    const description = String(body.description ?? '').trim() || null

    if (!organizer_name) {
      return NextResponse.json({ error: '主催者名は必須です' }, { status: 400 })
    }

    if (!contact_name || !contact_email || !phone) {
      return NextResponse.json({ error: '担当者名、連絡用メール、電話番号は入力してください' }, { status: 400 })
    }

    if (!description || description.length < 80) {
      return NextResponse.json({ error: '紹介文は80文字以上を目安に入力してください' }, { status: 400 })
    }

    const { data, error } = await (supabase as any)
      .from('organizer_profiles')
      .upsert(
        [
          {
            user_id: user.id,
            organizer_name,
            contact_name,
            contact_email,
            phone,
            logo_image_url,
            instagram_url,
            x_url,
            description,
          },
        ],
        { onConflict: 'user_id' }
      )
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('[organizer/profile POST]', error)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
