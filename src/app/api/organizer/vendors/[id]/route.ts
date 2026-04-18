import { NextRequest, NextResponse } from 'next/server'
import { requireRouteSession } from '@/lib/auth'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireRouteSession(req)
  if (auth.response) return auth.response
  const { supabase, role } = auth.session

  if (role !== 'organizer') {
    return NextResponse.json({ error: '主催者向けの画面です' }, { status: 403 })
  }

  const { data } = await (supabase as any)
    .rpc('get_vendor_public_profile', { target_user_id: params.id })
    .maybeSingle()

  if (!data) {
    return NextResponse.json({ error: 'ベンダー情報が見つかりません' }, { status: 404 })
  }

  return NextResponse.json({
    data: {
      user_id: params.id,
      business_name: data.business_name ?? '事業者',
      owner_name: data.owner_name ?? null,
      main_menu: data.main_menu ?? null,
      logo_image_url: data.logo_image_url ?? null,
      instagram_url: data.instagram_url ?? null,
      x_url: data.x_url ?? null,
      description: data.description ?? null,
    },
  })
}
