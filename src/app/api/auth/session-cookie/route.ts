import { NextRequest, NextResponse } from 'next/server'
import {
  getAllKnownAuthCookieNames,
  getAuthCookieDomain,
  getAuthCookieName,
  getScopeFromHost,
} from '@/lib/auth-cookie'

const ONE_WEEK_IN_SECONDS = 60 * 60 * 24 * 7

function shouldUseSecureCookie(host: string) {
  return !host.includes('localhost')
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const accessToken = typeof body?.access_token === 'string' ? body.access_token : null
  const host = request.headers.get('host') ?? ''
  const scope = getScopeFromHost(host)
  const cookieName = getAuthCookieName(scope)
  const cookieDomain = getAuthCookieDomain(scope) ?? undefined
  const secure = shouldUseSecureCookie(host)

  const response = NextResponse.json({ success: true })

  for (const knownCookieName of getAllKnownAuthCookieNames()) {
    response.cookies.set({
      name: knownCookieName,
      value: '',
      path: '/',
      maxAge: 0,
      sameSite: 'lax',
      secure,
      domain: cookieDomain,
    })
  }

  if (accessToken) {
    response.cookies.set({
      name: cookieName,
      value: accessToken,
      path: '/',
      maxAge: ONE_WEEK_IN_SECONDS,
      sameSite: 'lax',
      secure,
      domain: cookieDomain,
    })
  }

  return response
}
