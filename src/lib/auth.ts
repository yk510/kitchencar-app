import type { User } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getAuthCookieCandidateNames, getScopeFromHost } from '@/lib/auth-cookie'
import { createServerSupabaseClient } from '@/lib/supabase'
import type { AppRole } from '@/lib/user-role'

async function getUserFromAccessToken(accessToken?: string | null) {
  if (!accessToken) {
    return null
  }

  const supabase = createServerSupabaseClient(accessToken)
  const { data, error } = await supabase.auth.getUser(accessToken)

  if (error || !data.user) {
    return null
  }

  return {
    user: data.user,
    supabase,
    accessToken,
  }
}

async function getUserProfileForSession(session: Awaited<ReturnType<typeof getUserFromAccessToken>>) {
  if (!session) return null

  const { data } = await (session.supabase as any)
    .from('user_profiles')
    .select('user_id, role, display_name')
    .eq('user_id', session.user.id)
    .maybeSingle()

  return data ?? null
}

function getRoleFromMetadata(session: Awaited<ReturnType<typeof getUserFromAccessToken>>) {
  const metadataRole = session?.user?.user_metadata?.role
  return metadataRole === 'organizer' ? 'organizer' : metadataRole === 'vendor' ? 'vendor' : null
}

type SessionOptions = {
  includeProfile?: boolean
}

export async function getServerSession(options: SessionOptions = {}) {
  const { includeProfile = true } = options
  const cookieStore = await cookies()
  const headerStore = await headers()
  const scope = getScopeFromHost(headerStore.get('host') ?? '')
  const accessToken =
    getAuthCookieCandidateNames(scope)
      .map((name) => cookieStore.get(name)?.value)
      .find(Boolean) ?? null
  const session = await getUserFromAccessToken(accessToken)
  const profile = includeProfile ? await getUserProfileForSession(session) : null

  return session
    ? {
        ...session,
        profile,
        role: profile?.role ?? getRoleFromMetadata(session),
      }
    : null
}

export async function requireServerSession() {
  const session = await getServerSession()

  if (!session) {
    redirect('/login')
  }

  return session
}

export async function getRouteSession(request: NextRequest, options: SessionOptions = {}) {
  const { includeProfile = true } = options
  const scope = getScopeFromHost(request.headers.get('host') ?? '')
  const accessToken =
    getAuthCookieCandidateNames(scope)
      .map((name) => request.cookies.get(name)?.value)
      .find(Boolean) ?? null
  const session = await getUserFromAccessToken(accessToken)
  const profile = includeProfile ? await getUserProfileForSession(session) : null

  return session
    ? {
        ...session,
        profile,
        role: profile?.role ?? getRoleFromMetadata(session),
      }
    : null
}

export async function requireRouteSession(request: NextRequest, options: SessionOptions = {}) {
  const session = await getRouteSession(request, options)

  if (!session) {
    return {
      session: null,
      response: NextResponse.json({ error: 'ログインが必要です' }, { status: 401 }),
    }
  }

  return {
    session,
    response: null,
  }
}

export function buildUserScopedData<T extends Record<string, unknown>>(user: User, payload: T) {
  return {
    ...payload,
    user_id: user.id,
  }
}

export type { AppRole }
