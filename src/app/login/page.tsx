'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { BRAND_CONCEPT, BRAND_NAME, BRAND_STAGE_LABEL } from '@/lib/brand'
import {
  getAllKnownAuthCookieNames,
  getBrowserAuthCookieDomain,
  getBrowserAuthCookieName,
} from '@/lib/auth-cookie'
import { getHostScopeFromWindow } from '@/lib/domain'
import { fetchApi } from '@/lib/api-client'
import { usePersistentDraft } from '@/lib/usePersistentDraft'
import { getHomePathByRole, type AppRole } from '@/lib/user-role'

function syncBrowserAccessToken(accessToken?: string | null) {
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

async function waitForServerSessionReady() {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      await fetchApi('/api/user/profile', {
        cache: 'no-store',
        credentials: 'same-origin',
      })
      return true
    } catch {
      await new Promise((resolve) => window.setTimeout(resolve, 250))
    }
  }

  return false
}

export default function LoginPage() {
  const { supabase, loading } = useAuth()
  const hostScope = getHostScopeFromWindow()
  const roleParam = useMemo(() => {
    if (typeof window === 'undefined') return null
    return new URLSearchParams(window.location.search).get('role')
  }, [])
  const scopedRole: AppRole | null =
    roleParam === 'organizer' || roleParam === 'vendor'
      ? roleParam
      : hostScope
  const homePath = getHomePathByRole(scopedRole)
  const authDraft = usePersistentDraft('draft:login-form', {
    email: '',
    password: '',
  })
  const { value: draft, setValue: setDraft, clearDraft } = authDraft
  const { email, password } = draft
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setMessage(null)
    setError(null)

    try {
      if (!supabase) {
        throw new Error('ログイン機能の準備中です。少し待ってからもう一度お試しください。')
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        throw signInError
      }

      const {
        data: { session },
      } = await supabase.auth.getSession()

      syncBrowserAccessToken(session?.access_token ?? null)
      setMessage('ログインしました。ホームへ移動します。')
      clearDraft()

      const serverSessionReady = await waitForServerSessionReady()

      if (serverSessionReady) {
        window.location.replace(homePath)
        return
      }

      setMessage('ログインしました。ホームへ移動しています。数秒後に切り替わらない場合は再読み込みしてください。')
      window.setTimeout(() => {
        window.location.replace(homePath)
      }, 400)
    } catch (submitError: any) {
      setError(submitError.message ?? 'ログインに失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl items-center">
      <div className="grid w-full gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <section className="soft-panel rounded-[28px] px-7 py-8 lg:px-10 lg:py-10">
          <div className="flex items-center gap-2">
            <span className="badge-soft badge-blue">{BRAND_NAME}</span>
            <span className="rounded-full bg-[#eef4ff] px-3 py-1 text-[11px] font-semibold tracking-[0.12em] text-[var(--accent-blue)]">
              {BRAND_STAGE_LABEL}
            </span>
          </div>
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-700">
            {scopedRole === 'organizer' ? 'ORGANIZER WORKSPACE' : 'VENDOR WORKSPACE'}
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-[var(--text-main)]">
            {scopedRole === 'organizer'
              ? 'イベント募集と応募対応を、経営目線で前に進める'
              : '日々の営業を、経営判断につながる数字へ変える'}
          </h1>
          <p className="mt-3 text-sm font-semibold text-[var(--accent-blue)]">{BRAND_CONCEPT}</p>
          <p className="mt-4 text-sm leading-7 text-[var(--text-sub)]">
            {scopedRole === 'organizer'
              ? '主催者向けの専用入口です。募集作成、応募確認、主催者プロフィール管理を、ひと続きの業務として整理できます。'
              : '売上CSVの取り込み、出店場所の整理、営業予測、分析までをひとまとめにしたキッチンカーOSです。ログインすると、ご自身のデータだけが見える状態で使い始められます。'}
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {(scopedRole === 'organizer'
              ? [
                  ['1', '主催者プロフィール', 'ベンダーに伝わる主催者情報を整えます。'],
                  ['2', '募集作成', 'イベントや会場の魅力を写真つきで募集ページにまとめます。'],
                  ['3', '応募管理', '応募や質問への返答、出店決定まで進められます。'],
                ]
              : [
                  ['1', '売上データ取込', 'AirレジのCSVを入れるだけで日々の数字を整理します。'],
                  ['2', '営業予定と予測', 'カレンダー画像から翌月予定を作り、予測までつなげます。'],
                  ['3', '分析とふり返り', '場所・曜日・商品ごとの見え方を比較できます。'],
                ]).map(([step, title, description]) => (
              <div key={step} className="rounded-2xl border border-[var(--line-soft)] bg-white/80 p-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--accent-blue-soft)] text-sm font-bold text-[var(--accent-blue)]">
                  {step}
                </div>
                <p className="mt-3 font-semibold text-[var(--text-main)]">{title}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--text-sub)]">{description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="soft-panel rounded-[28px] px-6 py-7 lg:px-8 lg:py-8">
          <h2 className="text-xl font-bold text-[var(--text-main)]">アカウントにログイン</h2>
          <p className="mt-2 text-sm text-[var(--text-sub)]">
            登録したメールアドレスとパスワードを入力してください。
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--text-main)]">メールアドレス</label>
              <input
                type="email"
                value={email}
                onChange={(event) => setDraft((prev) => ({ ...prev, email: event.target.value }))}
                className="w-full px-4 py-3"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--text-main)]">パスワード</label>
              <input
                type="password"
                value={password}
                onChange={(event) => setDraft((prev) => ({ ...prev, password: event.target.value }))}
                className="w-full px-4 py-3"
                placeholder="8文字以上がおすすめです"
                minLength={6}
                required
              />
            </div>

            {message && (
              <div className="rounded-2xl border border-[var(--accent-green)]/20 bg-[var(--accent-green-soft)] px-4 py-3 text-sm text-[var(--accent-green)]">
                {message}
              </div>
            )}

            {error && (
              <div className="rounded-2xl border border-[var(--danger-line)] bg-[var(--danger-soft)] px-4 py-3 text-sm text-[#b5564b]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || loading}
              className="soft-button w-full rounded-full bg-[var(--accent-blue)] py-3 font-semibold text-white hover:bg-[#2f59d9] disabled:opacity-40"
            >
              {submitting ? '送信中...' : 'ログインする'}
            </button>
          </form>

          <div className="mt-6 rounded-3xl border border-[var(--line-soft)] bg-[#f8fbff] p-4">
            <p className="text-sm font-semibold text-[var(--text-main)]">はじめて使う場合</p>
            <p className="mt-2 text-sm leading-7 text-[var(--text-sub)]">
              LPから役割ごとの登録画面へ進めます。登録後は、そのまま初期プロフィール入力まで続けて進められます。
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              {scopedRole === 'organizer' ? (
                <Link href="/signup/organizer?from=login" className="soft-button rounded-full bg-white px-4 py-2 text-sm font-semibold text-[var(--accent-blue)] ring-1 ring-[var(--line-soft)]">
                  主催者として新規登録
                </Link>
              ) : scopedRole === 'vendor' ? (
                <Link href="/signup/vendor?from=login" className="soft-button rounded-full bg-white px-4 py-2 text-sm font-semibold text-[var(--accent-blue)] ring-1 ring-[var(--line-soft)]">
                  事業者として新規登録
                </Link>
              ) : (
                <>
                  <Link href="/signup/vendor?from=login" className="soft-button rounded-full bg-white px-4 py-2 text-sm font-semibold text-[var(--accent-blue)] ring-1 ring-[var(--line-soft)]">
                    事業者として新規登録
                  </Link>
                  <Link href="/signup/organizer?from=login" className="soft-button rounded-full bg-white px-4 py-2 text-sm font-semibold text-[var(--accent-blue)] ring-1 ring-[var(--line-soft)]">
                    主催者として新規登録
                  </Link>
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
