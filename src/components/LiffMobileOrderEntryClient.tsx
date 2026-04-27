'use client'

import Link from 'next/link'
import liff from '@line/liff'
import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

const LIFF_ORDER_CONTEXT_STORAGE_KEY = 'mobile-order:liff-context'

function persistLiffOrderContext(context: { lineUserId: string; lineDisplayName: string | null }) {
  if (typeof window === 'undefined') return

  window.sessionStorage.setItem(
    LIFF_ORDER_CONTEXT_STORAGE_KEY,
    JSON.stringify({
      lineUserId: context.lineUserId,
      lineDisplayName: context.lineDisplayName,
      savedAt: Date.now(),
    })
  )
}

function extractTokenFromLiffState(rawState: string | null) {
  const state = String(rawState ?? '').trim()
  if (!state) return ''

  const decodedState = decodeURIComponent(state)
  const candidates = [state, decodedState]

  for (const candidate of candidates) {
    try {
      const asUrl = new URL(candidate, 'https://dummy.local')
      const token = asUrl.searchParams.get('token')?.trim()
      if (token) return token
    } catch {
      // Ignore and continue to the fallback parsing below.
    }

    const queryIndex = candidate.indexOf('?')
    if (queryIndex >= 0) {
      const params = new URLSearchParams(candidate.slice(queryIndex + 1))
      const token = params.get('token')?.trim()
      if (token) return token
    }
  }

  return ''
}

function resolveToken(searchParams: URLSearchParams) {
  const directToken = searchParams.get('token')?.trim()
  if (directToken) return directToken

  const tokenFromState = extractTokenFromLiffState(searchParams.get('liff.state'))
  if (tokenFromState) return tokenFromState

  return ''
}

function buildOrderDestination(token: string, searchParams: URLSearchParams) {
  const nextParams = new URLSearchParams()

  const lineUserId = searchParams.get('line_user_id')
  const lineDisplayName = searchParams.get('line_display_name')

  if (lineUserId) nextParams.set('line_user_id', lineUserId)
  if (lineDisplayName) nextParams.set('line_display_name', lineDisplayName)

  const query = nextParams.toString()
  return query ? `/order/${token}?${query}` : `/order/${token}`
}

export default function LiffMobileOrderEntryClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = useMemo(() => resolveToken(searchParams), [searchParams])
  const [statusText, setStatusText] = useState('LINEの認証状態を確認しています...')
  const [error, setError] = useState<string | null>(null)

  const destination = useMemo(() => {
    if (!token) return null
    return buildOrderDestination(token, searchParams)
  }, [searchParams, token])

  useEffect(() => {
    if (!destination) return
    const safeDestination = destination

    let disposed = false

    async function bootstrapLiff() {
      const liffId = process.env.NEXT_PUBLIC_LINE_LIFF_ID?.trim()

      if (!liffId) {
        setStatusText('LIFF IDが未設定のため、そのまま注文ページへ移動します...')
        const timeoutId = window.setTimeout(() => {
          if (!disposed) router.replace(safeDestination)
        }, 500)
        return () => window.clearTimeout(timeoutId)
      }

      try {
        setStatusText('LINE LIFFを初期化しています...')
        await liff.init({ liffId })

        if (!liff.isLoggedIn()) {
          setStatusText('LINEログインへ移動しています...')
          liff.login({
            redirectUri: window.location.href,
          })
          return () => {}
        }

        let nextDestination = safeDestination

        try {
          const profile = await liff.getProfile()
          persistLiffOrderContext({
            lineUserId: profile.userId,
            lineDisplayName: profile.displayName || null,
          })
          const nextParams = new URLSearchParams()
          nextParams.set('line_user_id', profile.userId)
          if (profile.displayName) {
            nextParams.set('line_display_name', profile.displayName)
          }
          nextDestination = `/order/${token}?${nextParams.toString()}`
        } catch {
          // Profile acquisition is best-effort; fall back to the token-only route.
        }

        setStatusText('注文ページへ移動しています...')
        const timeoutId = window.setTimeout(() => {
          if (!disposed) router.replace(nextDestination)
        }, 300)

        return () => window.clearTimeout(timeoutId)
      } catch (nextError) {
        console.error('[LIFF bootstrap]', nextError)
        setError('LINE初期化に失敗しました。LINEからもう一度開いてください。')
        setStatusText('注文ページへ移動できませんでした')
        return () => {}
      }
    }

    let cleanup: (() => void) | undefined
    void bootstrapLiff().then((maybeCleanup) => {
      cleanup = maybeCleanup
    })

    return () => {
      disposed = true
      cleanup?.()
    }
  }, [destination, router])

  if (!token) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <div className="soft-panel rounded-[32px] p-8 text-center">
          <div className="badge-soft badge-orange inline-block">LIFF ENTRY</div>
          <h1 className="mt-5 text-2xl font-bold text-[var(--text-main)]">注文ページの情報が不足しています</h1>
          <p className="mt-4 text-sm leading-7 text-[var(--text-sub)]">
            LIFFの入口URLには、店舗を識別するための <code>token</code> パラメータが必要です。
          </p>
          <p className="mt-3 text-sm leading-7 text-[var(--text-sub)]">
            例: <code>/liff/mobile-order?token=xxxxxxxx</code>
          </p>
          <div className="mt-6">
            <Link
              href="/vendor/mobile-order"
              className="rounded-full bg-[var(--accent-blue)] px-5 py-3 text-sm font-semibold text-white"
            >
              モバイルオーダー設定へ戻る
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="soft-panel rounded-[32px] p-8 text-center">
        <div className="badge-soft badge-blue inline-block">LIFF ENTRY</div>
        <h1 className="mt-5 text-2xl font-bold text-[var(--text-main)]">注文ページへ移動しています</h1>
        <p className="mt-4 text-sm leading-7 text-[var(--text-sub)]">
          LINE内の共通入口から、店舗ごとの注文ページへ案内しています。
        </p>
        <p className="mt-3 text-sm font-medium text-[var(--accent-blue)]">{statusText}</p>
        <p className="mt-3 break-all text-xs text-[var(--text-soft)]">{destination}</p>
        {error && <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      </div>
    </div>
  )
}
