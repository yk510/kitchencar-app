import type { AppRole } from '@/lib/user-role'

export type AppHostScope = AppRole | null

function normalizeHost(rawHost: string) {
  return rawHost.trim().toLowerCase().replace(/:\d+$/, '')
}

function normalizePathname(pathname: string) {
  if (!pathname) return '/'
  if (pathname === '/') return pathname
  return pathname.replace(/\/+$/, '') || '/'
}

function readConfiguredHost(value?: string) {
  return value ? normalizeHost(value) : null
}

export function detectHostAppScope(host: string): AppHostScope {
  const normalizedHost = normalizeHost(host)
  if (!normalizedHost) return null

  const organizerHost =
    readConfiguredHost(process.env.NEXT_PUBLIC_ORGANIZER_APP_HOST) ??
    readConfiguredHost(process.env.ORGANIZER_APP_HOST)
  const vendorHost =
    readConfiguredHost(process.env.NEXT_PUBLIC_VENDOR_APP_HOST) ??
    readConfiguredHost(process.env.VENDOR_APP_HOST)

  if (organizerHost && normalizedHost === organizerHost) return 'organizer'
  if (vendorHost && normalizedHost === vendorHost) return 'vendor'

  if (normalizedHost.startsWith('organizer.') || normalizedHost.startsWith('org.')) return 'organizer'
  if (normalizedHost.startsWith('vendor.') || normalizedHost.startsWith('vnd.')) return 'vendor'

  return null
}

export function getHostScopeFromWindow(): AppHostScope {
  if (typeof window === 'undefined') return null
  return detectHostAppScope(window.location.host)
}

export function getScopedLoginRole(scope: AppHostScope): AppRole | null {
  return scope === 'organizer' || scope === 'vendor' ? scope : null
}

export function isOrganizerOnlyPath(pathname: string) {
  const normalizedPathname = normalizePathname(pathname)
  return normalizedPathname === '/organizer' || normalizedPathname.startsWith('/organizer/')
}

export function isPublicEntryPath(pathname: string) {
  const normalizedPathname = normalizePathname(pathname)
  return (
    normalizedPathname === '/lp' ||
    normalizedPathname === '/lp/vendor' ||
    normalizedPathname === '/lp/organizer' ||
    normalizedPathname === '/login' ||
    normalizedPathname === '/auth/confirmed' ||
    normalizedPathname.startsWith('/auth/confirmed/') ||
    normalizedPathname === '/liff/mobile-order' ||
    normalizedPathname.startsWith('/order/') ||
    normalizedPathname.startsWith('/public/offers/') ||
    normalizedPathname === '/signup/vendor' ||
    normalizedPathname === '/signup/organizer'
  )
}

export function isVendorPrimaryPath(pathname: string) {
  const normalizedPathname = normalizePathname(pathname)
  return (
    normalizedPathname === '/' ||
    normalizedPathname === '/upload' ||
    normalizedPathname === '/locations' ||
    normalizedPathname === '/products/master' ||
    normalizedPathname === '/plans' ||
    normalizedPathname === '/plans/new' ||
    normalizedPathname === '/stall-logs' ||
    normalizedPathname === '/analytics/cross' ||
    normalizedPathname === '/analytics/daily' ||
    normalizedPathname === '/analytics/locations' ||
    normalizedPathname === '/analytics/weekday' ||
    normalizedPathname === '/analytics/hourly' ||
    normalizedPathname === '/analytics/products' ||
    normalizedPathname === '/analytics/events' ||
    normalizedPathname === '/vendor' ||
    normalizedPathname.startsWith('/vendor/')
  )
}
