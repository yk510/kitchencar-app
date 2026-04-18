import { NextRequest, NextResponse } from 'next/server'
import { requireRouteSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = await requireRouteSession(req)
  if (auth.response) return auth.response

  return NextResponse.json({
    data: auth.session.profile,
    role: auth.session.role,
    email: auth.session.user.email ?? null,
  })
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRouteSession(req)
    if (auth.response) return auth.response
    const { supabase, user } = auth.session

    const body = await req.json()
    const role = body.role === 'organizer' ? 'organizer' : 'vendor'
    const display_name = String(body.display_name ?? '').trim() || null

    const { data, error } = await (supabase as any)
      .from('user_profiles')
      .upsert(
        [
          {
            user_id: user.id,
            role,
            display_name,
          },
        ],
        { onConflict: 'user_id' }
      )
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data, role: data.role })
  } catch (error) {
    console.error('[user/profile POST]', error)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
