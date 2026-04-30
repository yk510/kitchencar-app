'use client'

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { Session, SupabaseClient, User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import {
  getAllKnownAuthCookieNames,
  getAllKnownSupabaseStorageKeys,
  getBrowserAuthCookieDomain,
  getBrowserAuthCookieName,
} from '@/lib/auth-cookie'
import { ApiClientError, fetchApi } from '@/lib/api-client'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import type { Database } from '@/types/database'
import type { UserProfilePayload } from '@/types/api-payloads'

type AuthContextValue = {
  supabase: SupabaseClient<Database> | null
  session: Session | null
  user: User | null
  role: 'vendor' | 'organizer' | null
  hasProfile: boolean
  profileReady: boolean
  loading: boolean
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const LIFF_ORDER_CONTEXT_STORAGE_KEY = 'mobile-order:liff-context'

function clearLocalDraftsAndTransientState() {
  if (typeof window === 'undefined') return

  try {
    const keysToRemove: string[] = []

    for (let index = 0; index < window.localStorage.length; index += 1) {
      const key = window.localStorage.key(index)
      if (!key) continue

      if (
        key.startsWith('draft:') ||
        key === 'cross-analytics-presets' ||
        key === 'vendor-mobile-order-audio-enabled'
      ) {
        keysToRemove.push(key)
      }
    }

    for (const storageKey of getAllKnownSupabaseStorageKeys()) {
      keysToRemove.push(storageKey)
    }

    for (const key of Array.from(new Set(keysToRemove))) {
      window.localStorage.removeItem(key)
    }
  } catch {
    // ブラウザ保存領域の掃除失敗でログアウト自体は止めない
  }

  try {
    window.sessionStorage.removeItem(LIFF_ORDER_CONTEXT_STORAGE_KEY)
  } catch {
    // noop
  }
}

function syncAuthCookie(accessToken?: string | null) {
  if (typeof document === 'undefined') return
  const domain = getBrowserAuthCookieDomain()
  const cookieName = getBrowserAuthCookieName()
  const domainPart = domain ? `; domain=${domain}` : ''

  for (const knownCookieName of getAllKnownAuthCookieNames()) {
    if (knownCookieName === cookieName && accessToken) continue
    document.cookie = `${knownCookieName}=; path=/; max-age=0; samesite=lax${domainPart}`
    document.cookie = `${knownCookieName}=; path=/; max-age=0; samesite=lax`
  }

  if (accessToken) {
    document.cookie = `${cookieName}=${accessToken}; path=/; max-age=604800; samesite=lax${domainPart}`
    return
  }

  document.cookie = `${cookieName}=; path=/; max-age=0; samesite=lax${domainPart}`
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const supabase = useMemo(
    () => (typeof window === 'undefined' ? null : createBrowserSupabaseClient()),
    []
  )
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<'vendor' | 'organizer' | null>(null)
  const [hasProfile, setHasProfile] = useState(false)
  const [profileReady, setProfileReady] = useState(false)
  const activeUserIdRef = useRef<string | null>(null)

  async function refreshProfile() {
    if (!supabase) {
      setRole('vendor')
      setHasProfile(true)
      setProfileReady(true)
      return
    }

    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), 2500)

    try {
      const data = await fetchApi<UserProfilePayload>('/api/user/profile', {
        cache: 'no-store',
        signal: controller.signal,
      })
      setRole(data.role ?? 'vendor')
      setHasProfile(!!data.profile)
      setProfileReady(true)
    } catch {
      setRole('vendor')
      setHasProfile(false)
      setProfileReady(true)
    } finally {
      window.clearTimeout(timeoutId)
    }
  }

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      setProfileReady(true)
      return
    }

    let mounted = true
    const timeoutId = window.setTimeout(() => {
      if (mounted) {
        setLoading(false)
      }
    }, 3000)

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return
        setSession(data.session ?? null)
        const nextUserId = data.session?.user?.id ?? null
        activeUserIdRef.current = nextUserId
        syncAuthCookie(data.session?.access_token ?? null)
        if (data.session?.access_token) {
          setProfileReady(false)
          void refreshProfile()
        } else {
          clearLocalDraftsAndTransientState()
          setRole(null)
          setHasProfile(false)
          setProfileReady(true)
        }
        setLoading(false)
      })
      .catch(() => {
        if (!mounted) return
        setSession(null)
        activeUserIdRef.current = null
        syncAuthCookie(null)
        clearLocalDraftsAndTransientState()
        setRole(null)
        setHasProfile(false)
        setProfileReady(true)
        setLoading(false)
      })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      const nextUserId = nextSession?.user?.id ?? null
      const shouldClearTransientState =
        (!nextUserId && activeUserIdRef.current !== null) ||
        (nextUserId !== null && activeUserIdRef.current !== null && nextUserId !== activeUserIdRef.current)

      setSession(nextSession ?? null)
      activeUserIdRef.current = nextUserId
      syncAuthCookie(nextSession?.access_token ?? null)

      if (shouldClearTransientState || !nextSession?.access_token) {
        clearLocalDraftsAndTransientState()
      }

      if (nextSession?.access_token) {
        setProfileReady(false)
        void refreshProfile()
      } else {
        setRole(null)
        setHasProfile(false)
        setProfileReady(true)
      }
      setLoading(false)
      router.refresh()
    })

    return () => {
      mounted = false
      window.clearTimeout(timeoutId)
      subscription.subscription.unsubscribe()
    }
  }, [router, supabase])

  return (
    <AuthContext.Provider
      value={{
        supabase,
        session,
        user: session?.user ?? null,
        role,
        hasProfile,
        profileReady,
        loading,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const value = useContext(AuthContext)

  if (!value) {
    throw new Error('useAuth must be used within AuthProvider')
  }

  return value
}
