'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { getHostScopeFromWindow } from '@/lib/domain'

export const dynamic = 'force-dynamic'

export default function EmailConfirmedRedirectPage() {
  const router = useRouter()
  const { role } = useAuth()

  useEffect(() => {
    const resolvedRole = role ?? getHostScopeFromWindow() ?? 'vendor'
    router.replace(`/auth/confirmed/${resolvedRole}`)
  }, [role, router])

  return null
}
