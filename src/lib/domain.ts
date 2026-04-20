import type { AppRole } from '@/lib/user-role'

export type AppHostScope = AppRole | null

function normalizeHost(rawHost: string) {
  return rawHost.trim().toLowerCase().replace(/:\d+$/, '')
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

  if (normalizedHost.startsWith('organizer.')) return 'organizer'
  if (normalizedHost.startsWith('vendor.')) return 'vendor'

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
  return pathname === '/organizer' || pathname.startsWith('/organizer/')
}

export function isPublicEntryPath(pathname: string) {
  return (
    pathname === '/lp/vendor' ||
    pathname === '/lp/organizer' ||
    pathname === '/login' ||
    pathname === '/auth/confirmed' ||
    pathname.startsWith('/auth/confirmed/') ||
    pathname === '/signup/vendor' ||
    pathname === '/signup/organizer'
  )
}

export function isVendorPrimaryPath(pathname: string) {
  return (
    pathname === '/' ||
    pathname === '/upload' ||
    pathname === '/locations' ||
    pathname === '/products/master' ||
    pathname === '/plans' ||
    pathname === '/plans/new' ||
    pathname === '/stall-logs' ||
    pathname === '/analytics/cross' ||
    pathname === '/analytics/daily' ||
    pathname === '/analytics/locations' ||
    pathname === '/analytics/weekday' ||
    pathname === '/analytics/hourly' ||
    pathname === '/analytics/products' ||
    pathname === '/analytics/events' ||
    pathname === '/vendor' ||
    pathname.startsWith('/vendor/')
  )
}
