import { detectHostAppScope, type AppHostScope } from '@/lib/domain'

export const LEGACY_AUTH_COOKIE_NAME = 'kitchencar-access-token'
const DEFAULT_SUPABASE_STORAGE_KEY = 'kitchencar-auth'
const LEGACY_VENDOR_AUTH_COOKIE_NAME = `${LEGACY_AUTH_COOKIE_NAME}-vendor`
const LEGACY_ORGANIZER_AUTH_COOKIE_NAME = `${LEGACY_AUTH_COOKIE_NAME}-organizer`
const LEGACY_VENDOR_STORAGE_KEY = `${DEFAULT_SUPABASE_STORAGE_KEY}-vendor`
const LEGACY_ORGANIZER_STORAGE_KEY = `${DEFAULT_SUPABASE_STORAGE_KEY}-organizer`

function getScopedSuffix(scope: AppHostScope) {
  if (scope === 'vendor') return 'vendor'
  if (scope === 'organizer') return 'organizer'
  return 'app'
}

function readEnv(name: string) {
  return process.env[name] ?? null
}

export function getAuthCookieName(scope: AppHostScope) {
  if (scope === 'vendor') {
    return (
      readEnv('NEXT_PUBLIC_VENDOR_AUTH_COOKIE_NAME') ??
      readEnv('VENDOR_AUTH_COOKIE_NAME') ??
      `${LEGACY_AUTH_COOKIE_NAME}-vendor`
    )
  }

  if (scope === 'organizer') {
    return (
      readEnv('NEXT_PUBLIC_ORGANIZER_AUTH_COOKIE_NAME') ??
      readEnv('ORGANIZER_AUTH_COOKIE_NAME') ??
      `${LEGACY_AUTH_COOKIE_NAME}-organizer`
    )
  }

  return LEGACY_AUTH_COOKIE_NAME
}

export function getSupabaseStorageKey(scope: AppHostScope) {
  if (scope === 'vendor') {
    return (
      readEnv('NEXT_PUBLIC_VENDOR_SUPABASE_STORAGE_KEY') ??
      readEnv('VENDOR_SUPABASE_STORAGE_KEY') ??
      `${DEFAULT_SUPABASE_STORAGE_KEY}-vendor`
    )
  }

  if (scope === 'organizer') {
    return (
      readEnv('NEXT_PUBLIC_ORGANIZER_SUPABASE_STORAGE_KEY') ??
      readEnv('ORGANIZER_SUPABASE_STORAGE_KEY') ??
      `${DEFAULT_SUPABASE_STORAGE_KEY}-organizer`
    )
  }

  return DEFAULT_SUPABASE_STORAGE_KEY
}

export function getAuthCookieDomain(scope: AppHostScope) {
  if (scope === 'vendor') {
    return (
      readEnv('NEXT_PUBLIC_VENDOR_AUTH_COOKIE_DOMAIN') ??
      readEnv('VENDOR_AUTH_COOKIE_DOMAIN') ??
      null
    )
  }

  if (scope === 'organizer') {
    return (
      readEnv('NEXT_PUBLIC_ORGANIZER_AUTH_COOKIE_DOMAIN') ??
      readEnv('ORGANIZER_AUTH_COOKIE_DOMAIN') ??
      null
    )
  }

  return (
    readEnv('NEXT_PUBLIC_AUTH_COOKIE_DOMAIN') ??
    readEnv('AUTH_COOKIE_DOMAIN') ??
    null
  )
}

export function getScopeFromHost(host: string): AppHostScope {
  return detectHostAppScope(host)
}

export function getBrowserAuthScope(): AppHostScope {
  if (typeof window === 'undefined') return null
  return getScopeFromHost(window.location.host)
}

export function getBrowserAuthCookieName() {
  return getAuthCookieName(getBrowserAuthScope())
}

export function getBrowserSupabaseStorageKey() {
  return getSupabaseStorageKey(getBrowserAuthScope())
}

export function getBrowserAuthCookieDomain() {
  return getAuthCookieDomain(getBrowserAuthScope())
}

export function getAuthCookieCandidateNames(scope: AppHostScope) {
  const names = new Set<string>([
    getAuthCookieName(scope),
    LEGACY_AUTH_COOKIE_NAME,
    LEGACY_VENDOR_AUTH_COOKIE_NAME,
    LEGACY_ORGANIZER_AUTH_COOKIE_NAME,
  ])

  if (scope !== 'vendor') {
    names.add(getAuthCookieName('vendor'))
  }

  if (scope !== 'organizer') {
    names.add(getAuthCookieName('organizer'))
  }

  return Array.from(names)
}

export function getAllKnownAuthCookieNames() {
  return Array.from(
    new Set([
      LEGACY_AUTH_COOKIE_NAME,
      LEGACY_VENDOR_AUTH_COOKIE_NAME,
      LEGACY_ORGANIZER_AUTH_COOKIE_NAME,
      getAuthCookieName('vendor'),
      getAuthCookieName('organizer'),
      getAuthCookieName(null),
    ])
  )
}

export function getAllKnownSupabaseStorageKeys() {
  return Array.from(
    new Set([
      DEFAULT_SUPABASE_STORAGE_KEY,
      LEGACY_VENDOR_STORAGE_KEY,
      LEGACY_ORGANIZER_STORAGE_KEY,
      getSupabaseStorageKey('vendor'),
      getSupabaseStorageKey('organizer'),
      getSupabaseStorageKey(null),
    ])
  )
}
