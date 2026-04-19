import { NextRequest } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import type { UserProfilePayload, UserProfileUpdatePayload } from '@/types/api-payloads'

export async function GET(req: NextRequest) {
  const auth = await requireRouteSession(req)
  if (auth.response) return auth.response

  const payload: UserProfilePayload = {
    profile: auth.session.profile,
    role: auth.session.role,
    email: auth.session.user.email ?? null,
  }

  return apiOk(payload)
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
      return apiError(error.message)
    }

    const payload: UserProfileUpdatePayload = {
      profile: data,
      role: data.role,
    }

    return apiOk(payload)
  } catch (error) {
    console.error('[user/profile POST]', error)
    return apiError('サーバーエラー')
  }
}
