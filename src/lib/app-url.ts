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
  options?: { origin?: string | null }
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
    baseUrl.hash = ''
    return baseUrl.toString()
  }

  const configuredHost = readRoleHost(role)
  if (configuredHost) {
    return `https://${normalizeHost(configuredHost)}${pathname}`
  }

  return pathname
}
