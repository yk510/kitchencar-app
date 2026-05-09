import {
  type AppHostScope,
  isPathAccessibleToRole,
  isRoleCompatibleWithHost,
} from '@/lib/domain'
import type { AppRole } from '@/lib/user-role'

export type GuardResolution =
  | { action: 'allow' }
  | { action: 'redirect'; href: string }
  | { action: 'signout'; redirectToLogin: boolean }

export function resolveGuardAction({
  pathname,
  user,
  role,
  hostScope,
  isPublicPage,
  isSignupPage,
  isLandingPage,
  homePath,
  hasProfile,
  profileReady,
}: {
  pathname: string
  user: unknown
  role: AppRole | null
  hostScope: AppHostScope
  isPublicPage: boolean
  isSignupPage: boolean
  isLandingPage: boolean
  homePath: string
  hasProfile: boolean
  profileReady: boolean
}): GuardResolution {
  if (!user && !isPublicPage) {
    return { action: 'redirect', href: '/login' }
  }

  if (!user || !profileReady) {
    return { action: 'allow' }
  }

  if (role && !isRoleCompatibleWithHost(role, hostScope)) {
    return { action: 'signout', redirectToLogin: !isPublicPage }
  }

  if (isSignupPage && hasProfile) {
    return { action: 'redirect', href: homePath }
  }

  if (isLandingPage) {
    return { action: 'redirect', href: homePath }
  }

  if (role === 'organizer' && pathname === '/') {
    return { action: 'redirect', href: '/organizer' }
  }

  if (role === 'vendor' && !isPathAccessibleToRole(role, pathname)) {
    return { action: 'redirect', href: '/' }
  }

  if (role === 'organizer' && !isPathAccessibleToRole(role, pathname)) {
    return { action: 'redirect', href: '/organizer' }
  }

  return { action: 'allow' }
}
