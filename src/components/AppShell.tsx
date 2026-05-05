'use client'

import { Suspense, useEffect, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import HeaderNav from '@/components/HeaderNav'
import { useAuth } from '@/components/AuthProvider'
import { getHostScopeFromWindow, isPublicEntryPath } from '@/lib/domain'
import { subscribeProfileUpdated } from '@/lib/profile-sync'
import { getHomePathByRole } from '@/lib/user-role'

function LoadingScreen({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="soft-panel w-full max-w-md rounded-3xl px-8 py-10 text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[var(--accent-blue-soft)] border-t-[var(--accent-blue)]" />
        <p className="mt-5 text-sm font-medium text-[var(--text-sub)]">{message}</p>
      </div>
    </div>
  )
}

function ScrollToTopOnNavigation() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.history.scrollRestoration = 'manual'
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [pathname, searchParams])

  return null
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { loading, supabase, user, role, hasProfile, profileReady } = useAuth()
  const hostScope = useMemo(() => getHostScopeFromWindow(), [])
  const canResolveAuthenticatedRoutes = !loading && (!user || !!role)

  const isLoginPage = pathname === '/login'
  const isEmailConfirmedPage = pathname === '/auth/confirmed' || pathname.startsWith('/auth/confirmed/')
  const isSignupPage = pathname.startsWith('/signup/')
  const isLandingPage = pathname === '/lp' || pathname === '/lp/vendor' || pathname === '/lp/organizer'
  const isOrganizerPath = pathname === '/organizer' || pathname.startsWith('/organizer/')
  const isVendorPath = pathname === '/vendor' || pathname.startsWith('/vendor/')
  const isPublicPage = isPublicEntryPath(pathname)
  const homePath = getHomePathByRole(role)

  useEffect(() => {
    if (!canResolveAuthenticatedRoutes) return

    if (!user && !isPublicPage) {
      router.replace('/login')
      return
    }

    if (user && !profileReady) {
      return
    }

    if (user && role && hostScope && role !== hostScope) {
      void supabase?.auth.signOut()
      if (!isPublicPage) {
        router.replace('/login')
      }
      return
    }

    if (user && isSignupPage && profileReady && hasProfile) {
      router.replace(homePath)
      return
    }

    if (user && isLandingPage && profileReady) {
      router.replace(homePath)
      return
    }

    if (user && role === 'organizer' && pathname === '/') {
      router.replace('/organizer')
      return
    }

    if (user && role === 'vendor' && isOrganizerPath) {
      router.replace('/')
      return
    }

    if (user && role === 'organizer' && isVendorPath) {
      router.replace('/organizer')
    }
  }, [canResolveAuthenticatedRoutes, hasProfile, homePath, hostScope, isLandingPage, isLoginPage, isOrganizerPath, isSignupPage, isVendorPath, pathname, profileReady, role, router, supabase, user])

  useEffect(() => subscribeProfileUpdated(() => router.refresh()), [router])

  if (isLoginPage || isSignupPage || isEmailConfirmedPage || (!user && isPublicPage)) {
    return (
      <>
        <Suspense fallback={null}>
          <ScrollToTopOnNavigation />
        </Suspense>
        <main className="min-h-screen px-4 py-8 lg:px-6">{children}</main>
      </>
    )
  }

  if (!canResolveAuthenticatedRoutes) {
    return <LoadingScreen message="ログイン状態を確認しています..." />
  }

  if (!user && !isPublicPage) {
    return <LoadingScreen message="ログイン画面へ移動しています..." />
  }

  return (
    <>
      <Suspense fallback={null}>
        <ScrollToTopOnNavigation />
      </Suspense>
      <nav className="top-nav-wrap sticky top-0 z-30 px-4 py-2.5 lg:px-6">
        <div className="mx-auto max-w-7xl">
          <HeaderNav />
        </div>
      </nav>
      <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
    </>
  )
}
