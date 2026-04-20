import { NextRequest } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import { getVendorPublicProfile } from '@/lib/public-profiles'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireRouteSession(req)
  if (auth.response) return auth.response
  const { supabase, role } = auth.session

  if (role !== 'organizer') {
    return apiError('主催者向けの画面です', 403)
  }

  const data = await getVendorPublicProfile(supabase as any, params.id)

  if (!data) {
    return apiError('ベンダー情報が見つかりません', 404)
  }

  return apiOk({
    user_id: params.id,
    business_name: data.business_name ?? '事業者',
    owner_name: data.owner_name ?? null,
    genre: data.genre ?? null,
    main_menu: data.main_menu ?? null,
    logo_image_url: data.logo_image_url ?? null,
    instagram_url: data.instagram_url ?? null,
    x_url: data.x_url ?? null,
    description: data.description ?? null,
  })
}
