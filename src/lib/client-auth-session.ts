import type { Session, SupabaseClient, User } from '@supabase/supabase-js'
import { buildCompactAuthMetadata, needsAuthMetadataCompaction } from '@/lib/auth-metadata'
import {
  getAllKnownAuthCookieNames,
  getBrowserAuthCookieDomain,
  getBrowserAuthCookieName,
} from '@/lib/auth-cookie'
import type { Database } from '@/types/database'

export type AuthenticatedRole = 'vendor' | 'organizer' | null

export function getRoleFromSupabaseUser(user?: User | null): AuthenticatedRole {
  const metadataRole = user?.user_metadata?.role ?? user?.app_metadata?.role
  return metadataRole === 'organizer'
    ? 'organizer'
    : metadataRole === 'vendor'
      ? 'vendor'
      : null
}

export function syncBrowserAccessToken(accessToken?: string | null) {
  if (typeof document === 'undefined') return

  const domain = getBrowserAuthCookieDomain()
  const cookieName = getBrowserAuthCookieName()
  const domainPart = domain ? `; domain=${domain}` : ''

  for (const knownCookieName of getAllKnownAuthCookieNames()) {
    if (knownCookieName === cookieName && accessToken) continue
    document.cookie = `${knownCookieName}=; path=/; max-age=0; samesite=lax${domainPart}`
    document.cookie = `${knownCookieName}=; path=/; max-age=0; samesite=lax`
  }

  if (accessToken) {
    document.cookie = `${cookieName}=${accessToken}; path=/; max-age=604800; samesite=lax${domainPart}`
    return
  }

  document.cookie = `${cookieName}=; path=/; max-age=0; samesite=lax${domainPart}`
}

export async function persistServerSessionCookie(accessToken?: string | null) {
  if (!accessToken) return false

  const response = await fetch('/api/auth/session-cookie', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: 'same-origin',
    body: JSON.stringify({
      access_token: accessToken,
    }),
  })

  return response.ok
}

export async function compactMetadataAndPersistSession(
  supabase: SupabaseClient<Database>
): Promise<Session | null> {
  const {
    data: { session: initialSession },
  } = await supabase.auth.getSession()

  let finalizedSession = initialSession ?? null

  if (needsAuthMetadataCompaction(initialSession?.user?.user_metadata)) {
    await supabase.auth.updateUser({
      data: buildCompactAuthMetadata(initialSession?.user?.user_metadata),
    })
    await supabase.auth.refreshSession()

    const {
      data: { session: compactedSession },
    } = await supabase.auth.getSession()

    finalizedSession = compactedSession ?? initialSession ?? null
  }

  syncBrowserAccessToken(finalizedSession?.access_token ?? null)
  await persistServerSessionCookie(finalizedSession?.access_token ?? null)

  return finalizedSession
}
