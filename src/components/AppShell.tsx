'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import HeaderNav from '@/components/HeaderNav'
import { useAuth } from '@/components/AuthProvider'

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

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { loading, user } = useAuth()

  const isLoginPage = pathname === '/login'

  useEffect(() => {
    if (loading) return

    if (!user && !isLoginPage) {
      router.replace('/login')
      return
    }

    if (user && isLoginPage) {
      router.replace('/')
    }
  }, [isLoginPage, loading, router, user])

  if (isLoginPage) {
    return <main className="min-h-screen px-4 py-8 lg:px-6">{children}</main>
  }

  if (loading) {
    return <LoadingScreen message="ログイン状態を確認しています..." />
  }

  if (!user && !isLoginPage) {
    return <LoadingScreen message="ログイン画面へ移動しています..." />
  }

  return (
    <>
      <nav className="top-nav-wrap sticky top-0 z-30 px-4 py-2.5 lg:px-6">
        <div className="mx-auto max-w-7xl">
          <HeaderNav />
        </div>
      </nav>
      <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
    </>
  )
}
