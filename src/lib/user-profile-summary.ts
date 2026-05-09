import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { ApiClientError, fetchApi } from '@/lib/api-client'
import { getRoleFromSupabaseUser } from '@/lib/client-auth-session'
import type { Database } from '@/types/database'
import type { UserProfileSummaryPayload } from '@/types/api-payloads'

export async function fetchUserProfileSummary({
  supabase,
  session,
  signal,
}: {
  supabase: SupabaseClient<Database>
  session: Session | null
  signal?: AbortSignal
}): Promise<UserProfileSummaryPayload> {
  try {
    return await fetchApi<UserProfileSummaryPayload>('/api/user/profile/summary', {
      cache: 'no-store',
      signal,
    })
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 401) {
      return {
        hasProfile: false,
        role: null,
        email: null,
      }
    }

    const {
      data: { session: nextSession },
    } = await supabase.auth.getSession()

    return {
      hasProfile: false,
      role:
        getRoleFromSupabaseUser(nextSession?.user) ??
        getRoleFromSupabaseUser(session?.user) ??
        null,
      email: nextSession?.user?.email ?? session?.user?.email ?? null,
    }
  }
}
