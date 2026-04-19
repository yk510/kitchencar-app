'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { Session, SupabaseClient, User } from '@supabase/supabase-js'
import { useRouter } from 'next/navigation'
import { AUTH_COOKIE_NAME } from '@/lib/auth-cookie'
import { ApiClientError, fetchApi } from '@/lib/api-client'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import type { Database } from '@/types/database'
import type { UserProfilePayload } from '@/types/api-payloads'

type AuthContextValue = {
  supabase: SupabaseClient<Database> | null
  session: Session | null
  user: User | null
  role: 'vendor' | 'organizer' | null
  profileReady: boolean
  loading: boolean
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function syncAuthCookie(accessToken?: string | null) {
  if (typeof document === 'undefined') return

  if (accessToken) {
    document.cookie = `${AUTH_COOKIE_NAME}=${accessToken}; path=/; max-age=604800; samesite=lax`
    return
  }

  document.cookie = `${AUTH_COOKIE_NAME}=; path=/; max-age=0; samesite=lax`
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
  const [profileReady, setProfileReady] = useState(false)

  async function refreshProfile() {
    if (!supabase) {
      setRole('vendor')
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
      setProfileReady(true)
    } catch {
      setRole('vendor')
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
        syncAuthCookie(data.session?.access_token ?? null)
        if (data.session?.access_token) {
          setProfileReady(false)
          void refreshProfile()
        } else {
          setRole(null)
          setProfileReady(true)
        }
        setLoading(false)
      })
      .catch(() => {
        if (!mounted) return
        setSession(null)
        syncAuthCookie(null)
        setRole(null)
        setProfileReady(true)
        setLoading(false)
      })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession ?? null)
      syncAuthCookie(nextSession?.access_token ?? null)
      if (nextSession?.access_token) {
        setProfileReady(false)
        void refreshProfile()
      } else {
        setRole(null)
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
