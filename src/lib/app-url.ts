import type { AppRole } from '@/lib/user-role'

function normalizeHost(rawHost: string) {
  return rawHost.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '')
}

function readRoleHost(role: AppRole) {
  if (role === 'organizer') {
    return (
      process.env.NEXT_PUBLIC_ORGANIZER_APP_HOST ??
      process.env.ORGANIZER_APP_HOST ??
      null
    )
  }

  return (
    process.env.NEXT_PUBLIC_VENDOR_APP_HOST ??
    process.env.VENDOR_APP_HOST ??
    null
  )
}

export function buildRoleAppUrl(
  role: AppRole,
  pathname: string,
  options?: { origin?: string | null; searchParams?: Record<string, string | null | undefined> }
) {
  const origin = options?.origin ?? null

  if (origin) {
    const baseUrl = new URL(origin)
    const configuredHost = readRoleHost(role)

    if (configuredHost) {
      baseUrl.host = normalizeHost(configuredHost)
    } else if (baseUrl.hostname === 'localhost') {
      baseUrl.host = `${role}.localhost${baseUrl.port ? `:${baseUrl.port}` : ''}`
    }

    baseUrl.pathname = pathname
    baseUrl.search = ''
    for (const [key, value] of Object.entries(options?.searchParams ?? {})) {
      if (value) baseUrl.searchParams.set(key, value)
    }
    baseUrl.hash = ''
    return baseUrl.toString()
  }

  const configuredHost = readRoleHost(role)
  if (configuredHost) {
    const baseUrl = new URL(`https://${normalizeHost(configuredHost)}`)
    baseUrl.pathname = pathname
    for (const [key, value] of Object.entries(options?.searchParams ?? {})) {
      if (value) baseUrl.searchParams.set(key, value)
    }
    return baseUrl.toString()
  }

  const fallbackUrl = new URL(pathname, 'https://example.local')
  for (const [key, value] of Object.entries(options?.searchParams ?? {})) {
    if (value) fallbackUrl.searchParams.set(key, value)
  }

  return `${fallbackUrl.pathname}${fallbackUrl.search}`
}
