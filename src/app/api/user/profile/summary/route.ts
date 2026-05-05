import { NextRequest } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { apiOk } from '@/lib/api-response'
import type { UserProfileSummaryPayload } from '@/types/api-payloads'

export async function GET(req: NextRequest) {
  const auth = await requireRouteSession(req, { includeProfile: false })
  if (auth.response) return auth.response

  const { supabase, user, role } = auth.session
  const { data: profileRow } = await (supabase as any)
    .from('user_profiles')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  const payload: UserProfileSummaryPayload = {
    hasProfile: !!profileRow,
    role: role ?? null,
    email: user.email ?? null,
  }

  return apiOk(payload)
}
