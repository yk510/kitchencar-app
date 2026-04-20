import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { detectHostAppScope, isOrganizerOnlyPath, isPublicEntryPath } from '@/lib/domain'

function redirectTo(request: NextRequest, pathname: string) {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  url.search = ''
  return NextResponse.redirect(url)
}

export function middleware(request: NextRequest) {
  const scope = detectHostAppScope(request.headers.get('host') ?? '')
  if (!scope) return NextResponse.next()

  const { pathname } = request.nextUrl

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/favicon.ico' ||
    pathname.match(/\.(?:png|jpg|jpeg|gif|svg|webp|ico|txt|xml)$/)
  ) {
    return NextResponse.next()
  }

  if (pathname === '/account/role') {
    return redirectTo(request, '/login')
  }

  if (scope === 'organizer') {
    if (pathname === '/') {
      return redirectTo(request, '/lp/organizer')
    }

    if (pathname === '/signup/vendor') {
      return redirectTo(request, '/signup/organizer')
    }

    if (
      pathname === '/login' ||
      pathname === '/signup/organizer' ||
      pathname === '/lp/organizer' ||
      isOrganizerOnlyPath(pathname)
    ) {
      return NextResponse.next()
    }

    return redirectTo(request, '/organizer')
  }

  if (scope === 'vendor' && pathname === '/signup/organizer') {
    return redirectTo(request, '/signup/vendor')
  }

  if (scope === 'vendor' && pathname === '/organizer') {
    return redirectTo(request, '/')
  }

  if (scope === 'vendor' && isOrganizerOnlyPath(pathname) && !isPublicEntryPath(pathname)) {
    return redirectTo(request, '/')
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}
