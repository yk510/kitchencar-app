import { NextRequest, NextResponse } from 'next/server'
import { requireRouteSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = await requireRouteSession(req)
  if (auth.response) return auth.response
  const { supabase, user } = auth.session

  const { data, error } = await (supabase as any)
    .from('vendor_profiles')
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
    const business_name = String(body.business_name ?? '').trim()
    const owner_name = String(body.owner_name ?? '').trim() || null
    const contact_email = String(body.contact_email ?? '').trim() || user.email || null
    const phone = String(body.phone ?? '').trim() || null
    const main_menu = String(body.main_menu ?? '').trim() || null
    const logo_image_url = String(body.logo_image_url ?? '').trim() || null
    const instagram_url = String(body.instagram_url ?? '').trim() || null
    const x_url = String(body.x_url ?? '').trim() || null
    const description = String(body.description ?? '').trim() || null

    if (!business_name) {
      return NextResponse.json({ error: '事業者名は必須です' }, { status: 400 })
    }

    const { data, error } = await (supabase as any)
      .from('vendor_profiles')
      .upsert(
        [
          {
            user_id: user.id,
            business_name,
            owner_name,
            contact_email,
            phone,
            main_menu,
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
    console.error('[vendor/profile POST]', error)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
