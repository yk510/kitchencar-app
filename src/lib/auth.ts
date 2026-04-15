import type { User } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { AUTH_COOKIE_NAME } from '@/lib/auth-cookie'
import { createServerSupabaseClient } from '@/lib/supabase'

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

export async function getServerSession() {
  const cookieStore = await cookies()
  const accessToken = cookieStore.get(AUTH_COOKIE_NAME)?.value
  return getUserFromAccessToken(accessToken)
}

export async function requireServerSession() {
  const session = await getServerSession()

  if (!session) {
    redirect('/login')
  }

  return session
}

export async function getRouteSession(request: NextRequest) {
  const accessToken = request.cookies.get(AUTH_COOKIE_NAME)?.value
  return getUserFromAccessToken(accessToken)
}

export async function requireRouteSession(request: NextRequest) {
  const session = await getRouteSession(request)

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
