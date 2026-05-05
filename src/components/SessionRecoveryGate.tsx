'use client'

import { useEffect, useMemo, useState } from 'react'
import { compactMetadataAndPersistSession, getRoleFromSupabaseUser, type AuthenticatedRole } from '@/lib/client-auth-session'
import { createBrowserSupabaseClient } from '@/lib/supabase'
import { getHomePathByRole } from '@/lib/user-role'

export default function SessionRecoveryGate({
  targetPath,
  expectedRole,
  fallbackPath = '/lp',
}: {
  targetPath: string
  expectedRole?: AuthenticatedRole
  fallbackPath?: string
}) {
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const [message, setMessage] = useState('ログイン状態を確認しています...')

  useEffect(() => {
    let cancelled = false

    async function recoverSession() {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()

        if (!session?.access_token) {
          if (!cancelled) {
            window.location.replace(fallbackPath)
          }
          return
        }

        setMessage('ログイン状態を復元しています...')
        const recoveredSession = await compactMetadataAndPersistSession(supabase)
        const resolvedRole = getRoleFromSupabaseUser(recoveredSession?.user)

        if (!cancelled && expectedRole && resolvedRole && resolvedRole !== expectedRole) {
          window.location.replace(getHomePathByRole(resolvedRole))
          return
        }

        if (!cancelled) {
          window.location.replace(targetPath)
        }
      } catch {
        if (!cancelled) {
          window.location.replace(fallbackPath)
        }
      }
    }

    void recoverSession()

    return () => {
      cancelled = true
    }
  }, [expectedRole, fallbackPath, supabase, targetPath])

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="soft-panel w-full max-w-md rounded-3xl px-8 py-10 text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[var(--accent-blue-soft)] border-t-[var(--accent-blue)]" />
        <p className="mt-5 text-sm font-medium text-[var(--text-sub)]">{message}</p>
      </div>
    </div>
  )
}
