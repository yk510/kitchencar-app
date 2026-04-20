'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { BRAND_CONCEPT, BRAND_NAME, BRAND_STAGE_LABEL } from '@/lib/brand'
import {
  getAllKnownAuthCookieNames,
  getBrowserAuthCookieDomain,
  getBrowserAuthCookieName,
} from '@/lib/auth-cookie'
import { ApiClientError, fetchApi } from '@/lib/api-client'
import { notifyProfileUpdated } from '@/lib/profile-sync'
import { getHomePathByRole, type AppRole } from '@/lib/user-role'
import { useAuth } from '@/components/AuthProvider'

function OnboardingCards({ role }: { role: AppRole }) {
  const items =
    role === 'organizer'
      ? [
          {
            step: '1',
            title: '主催者プロフィールを整える',
            description:
              '主催者名、紹介文、ロゴやSNSを整えると、応募前のベンダーに安心感を伝えやすくなります。',
          },
          {
            step: '2',
            title: '最初の募集を公開する',
            description:
              '会場写真や募集背景、条件をまとめて、伝わる募集ページを作成できます。',
          },
          {
            step: '3',
            title: '応募管理を一元化する',
            description:
              '応募確認、メッセージ対応、出店決定までをプラットフォーム上で進められます。',
          },
        ]
      : [
          {
            step: '1',
            title: '売上データを取り込む',
            description:
              'AirレジのCSVを入れるだけで、場所別・イベント別・天候別などの分析を始められます。',
          },
          {
            step: '2',
            title: '営業予定と予測を作る',
            description:
              'カレンダー画像をアップロードして、過去実績をもとに売上予測までつなげられます。',
          },
          {
            step: '3',
            title: '週報でふり返る',
            description:
              '日々の営業メモや売上をもとに、AI週報と次のアクションのヒントを受け取れます。',
          },
        ]

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {items.map((item) => (
        <div key={item.step} className="soft-panel rounded-[28px] p-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent-blue-soft)] text-sm font-bold text-[var(--accent-blue)]">
            {item.step}
          </div>
          <h2 className="mt-4 text-lg font-semibold text-[var(--text-main)]">{item.title}</h2>
          <p className="mt-2 text-sm leading-7 text-[var(--text-sub)]">{item.description}</p>
        </div>
      ))}
    </div>
  )
}

export default function EmailConfirmedContent({ role }: { role: AppRole }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { supabase, user, loading, hasProfile, profileReady, refreshProfile } = useAuth()
  const dashboardHref = getHomePathByRole(role)
  const [confirmationStatus, setConfirmationStatus] = useState<'idle' | 'confirming' | 'confirmed' | 'error'>('idle')
  const [confirmationError, setConfirmationError] = useState<string | null>(null)
  const [profileBootstrapStatus, setProfileBootstrapStatus] = useState<'idle' | 'bootstrapping' | 'done' | 'error'>('idle')
  const [profileBootstrapError, setProfileBootstrapError] = useState<string | null>(null)
  const [hashParsed, setHashParsed] = useState(false)
  const [hashSessionParams, setHashSessionParams] = useState<{
    accessToken: string | null
    refreshToken: string | null
    tokenType: string | null
  } | null>(null)

  const authCode = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const otpType = searchParams.get('type')
  const queryAccessToken = searchParams.get('access_token')
  const queryRefreshToken = searchParams.get('refresh_token')
  const hashAccessToken = hashSessionParams?.accessToken ?? null
  const hashRefreshToken = hashSessionParams?.refreshToken ?? null
  const sessionAccessToken = queryAccessToken ?? hashAccessToken
  const sessionRefreshToken = queryRefreshToken ?? hashRefreshToken
  const sessionReady = confirmationStatus === 'confirmed' && !loading && !!user && profileReady

  useEffect(() => {
    if (typeof window === 'undefined') return

    const rawHash = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash

    if (!rawHash) return

    const params = new URLSearchParams(rawHash)
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    const tokenType = params.get('token_type')

    if (accessToken && refreshToken) {
      setHashSessionParams({
        accessToken,
        refreshToken,
        tokenType,
      })
    }

    setHashParsed(true)
  }, [])

  function syncBrowserAccessToken(accessToken?: string | null) {
    if (typeof document === 'undefined') return
    const domain = getBrowserAuthCookieDomain()
    const cookieName = getBrowserAuthCookieName()
    const domainPart = domain ? `; domain=${domain}` : ''

    for (const knownCookieName of getAllKnownAuthCookieNames()) {
      if (knownCookieName === cookieName && accessToken) continue
      document.cookie = `${knownCookieName}=; path=/; max-age=0; samesite=lax${domainPart}`
    }

    if (accessToken) {
      document.cookie = `${cookieName}=${accessToken}; path=/; max-age=604800; samesite=lax${domainPart}`
      return
    }

    document.cookie = `${cookieName}=; path=/; max-age=0; samesite=lax${domainPart}`
  }

  async function waitForServerSessionReady() {
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const response = await fetch('/api/user/profile', {
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin',
      })

      if (response.ok) {
        return true
      }

      await new Promise((resolve) => window.setTimeout(resolve, 250))
    }

    return false
  }

  const needsExchange = useMemo(
    () => !!supabase && (!!authCode || !!tokenHash || !!sessionAccessToken),
    [authCode, sessionAccessToken, supabase, tokenHash]
  )
  const dashboardReady =
    sessionReady &&
    (hasProfile || profileBootstrapStatus === 'done' || profileBootstrapStatus === 'error')

  useEffect(() => {
    if (!supabase) return
    if (!hashParsed) return
    if (!needsExchange) {
      setConfirmationStatus('confirmed')
      return
    }

    let cancelled = false
    const client = supabase

    async function confirmSession() {
      setConfirmationStatus('confirming')
      setConfirmationError(null)

      try {
        if (authCode) {
          const { error } = await client.auth.exchangeCodeForSession(authCode)
          if (error) throw error
        } else if (tokenHash && otpType) {
          const { error } = await (client.auth as any).verifyOtp({
            token_hash: tokenHash,
            type: otpType,
          })
          if (error) throw error
        } else if (sessionAccessToken && sessionRefreshToken) {
          const { error } = await client.auth.setSession({
            access_token: sessionAccessToken,
            refresh_token: sessionRefreshToken,
          })
          if (error) throw error
        }

        const {
          data: { session },
        } = await client.auth.getSession()

        syncBrowserAccessToken(session?.access_token ?? null)

        const serverSessionReady = await waitForServerSessionReady()

        if (cancelled) return
        window.history.replaceState({}, '', pathname)
        setConfirmationStatus('confirmed')
        if (!serverSessionReady) {
          setConfirmationError(
            'ログイン状態の反映に少し時間がかかっています。数秒待ってから「ダッシュボードへ進む」を押してください。'
          )
        }
        router.refresh()
      } catch (error) {
        if (cancelled) return
        setConfirmationStatus('error')
        setConfirmationError(
          error instanceof Error
            ? error.message
            : '確認リンクの処理に失敗しました。もう一度メール内のリンクを開いてください。'
        )
      }
    }

    void confirmSession()

    return () => {
      cancelled = true
    }
  }, [authCode, hashParsed, needsExchange, otpType, pathname, queryAccessToken, queryRefreshToken, router, sessionAccessToken, sessionRefreshToken, supabase, tokenHash])

  useEffect(() => {
    if (confirmationStatus !== 'confirmed') return
    if (!user || !profileReady || hasProfile) return

    const storageKey = `draft:signup-${role}-form`

    type VendorDraft = {
      business_name?: string
      owner_name?: string
      contact_email?: string
      phone?: string
      genre?: string
      main_menu?: string
      logo_image_url?: string
      instagram_url?: string
      x_url?: string
      description?: string
    }

    type OrganizerDraft = {
      organizer_name?: string
      contact_name?: string
      contact_email?: string
      phone?: string
      logo_image_url?: string
      instagram_url?: string
      x_url?: string
      description?: string
    }

    const storedDraft =
      typeof window !== 'undefined' ? window.localStorage.getItem(storageKey) : null

    const fallbackProfile =
      (user.user_metadata?.onboarding_profile as VendorDraft | OrganizerDraft | undefined) ?? null

    const draftProfile = storedDraft ? (JSON.parse(storedDraft) as VendorDraft | OrganizerDraft) : null
    const sourceProfile = draftProfile ?? fallbackProfile

    if (!sourceProfile) {
      setProfileBootstrapStatus('done')
      return
    }

    const currentUser = user
    if (!currentUser) {
      return
    }

    let cancelled = false

    async function bootstrapProfile() {
      setProfileBootstrapStatus('bootstrapping')
      setProfileBootstrapError(null)

      try {
        const displayName =
          role === 'vendor'
            ? String((sourceProfile as VendorDraft).business_name ?? '').trim()
            : String((sourceProfile as OrganizerDraft).organizer_name ?? '').trim()

        await fetchApi('/api/user/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role,
            display_name: displayName,
          }),
        })

        if (role === 'vendor') {
          const vendorProfile = sourceProfile as VendorDraft
          await fetchApi('/api/vendor/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              business_name: vendorProfile.business_name ?? '',
              owner_name: vendorProfile.owner_name ?? '',
              contact_email: vendorProfile.contact_email ?? currentUser.email ?? '',
              phone: vendorProfile.phone ?? '',
              genre: vendorProfile.genre ?? '',
              main_menu: vendorProfile.main_menu ?? '',
              logo_image_url: vendorProfile.logo_image_url ?? '',
              instagram_url: vendorProfile.instagram_url ?? '',
              x_url: vendorProfile.x_url ?? '',
              description: vendorProfile.description ?? '',
            }),
          })
        } else {
          const organizerProfile = sourceProfile as OrganizerDraft
          await fetchApi('/api/organizer/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              organizer_name: organizerProfile.organizer_name ?? '',
              contact_name: organizerProfile.contact_name ?? '',
              contact_email: organizerProfile.contact_email ?? currentUser.email ?? '',
              phone: organizerProfile.phone ?? '',
              logo_image_url: organizerProfile.logo_image_url ?? '',
              instagram_url: organizerProfile.instagram_url ?? '',
              x_url: organizerProfile.x_url ?? '',
              description: organizerProfile.description ?? '',
            }),
          })
        }

        if (cancelled) return

        if (typeof window !== 'undefined') {
          window.localStorage.removeItem(storageKey)
        }

        await refreshProfile()
        notifyProfileUpdated()
        setProfileBootstrapStatus('done')
      } catch (error) {
        if (cancelled) return
        setProfileBootstrapStatus('error')
        setProfileBootstrapError(
          error instanceof ApiClientError || error instanceof Error
            ? error.message
            : 'プロフィール初期設定の反映に失敗しました。ダッシュボードから設定画面を開いて、保存をお試しください。'
        )
      }
    }

    void bootstrapProfile()

    return () => {
      cancelled = true
    }
  }, [confirmationStatus, hasProfile, profileReady, refreshProfile, role, user])

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <section className="soft-panel rounded-[32px] px-8 py-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge-soft badge-blue">{BRAND_NAME}</span>
          <span className="rounded-full bg-[#eef4ff] px-3 py-1 text-[11px] font-semibold tracking-[0.12em] text-[var(--accent-blue)]">
            {BRAND_STAGE_LABEL}
          </span>
        </div>
        <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-700">
          {role === 'organizer' ? 'ORGANIZER EMAIL CONFIRMED' : 'VENDOR EMAIL CONFIRMED'}
        </p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-[var(--text-main)]">
          メールアドレスの確認が完了しました
        </h1>
        <p className="mt-3 text-sm font-semibold text-[var(--accent-blue)]">{BRAND_CONCEPT}</p>
        <p className="mt-4 text-sm leading-7 text-[var(--text-sub)]">
          ここから先は、クリダス!!でできることを軽く確認してからダッシュボードへ進めます。
          最初の一歩が分かりやすいように、役割に合わせた使い方をまとめています。
        </p>
      </section>

      <OnboardingCards role={role} />

      <section className="soft-panel rounded-[32px] px-8 py-8">
        <h2 className="text-xl font-bold text-[var(--text-main)]">次にやること</h2>
        <p className="mt-3 text-sm leading-7 text-[var(--text-sub)]">
          {confirmationStatus === 'confirming'
          ? 'メール確認を完了して、ログイン状態を準備しています。数秒だけお待ちください。'
            : profileBootstrapStatus === 'bootstrapping'
              ? '登録時に入力したプロフィールを反映しています。数秒だけお待ちください。'
            : confirmationStatus === 'error'
              ? '確認リンクの処理でエラーがありました。下の案内を確認して、必要ならログイン画面から入り直してください。'
            : loading || (user && !profileReady)
              ? 'ログイン状態を確認しています。数秒たってから下のボタンを押してください。'
            : !user
              ? '同じブラウザでログイン状態を引き継げなかったため、もう一度ログインして続きから進めてください。'
            : !hasProfile && profileBootstrapStatus === 'done'
              ? 'ログイン状態の引き継ぎは完了しています。プロフィール反映はダッシュボードから続けて確認できます。'
            : role === 'organizer'
              ? 'まずは主催者プロフィールを確認し、そのあと最初の募集作成へ進むのがおすすめです。'
              : 'まずは売上データ取込や事業者設定の確認から始めるのがおすすめです。'}
        </p>
        {confirmationError && (
          <div className="mt-4 rounded-2xl border border-[var(--danger-line)] bg-[var(--danger-soft)] px-4 py-3 text-sm text-[#b5564b]">
            {confirmationError}
          </div>
        )}
        {profileBootstrapError && (
          <div className="mt-4 rounded-2xl border border-[var(--danger-line)] bg-[var(--danger-soft)] px-4 py-3 text-sm text-[#b5564b]">
            {profileBootstrapError}
          </div>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={!dashboardReady}
            onClick={() => {
              if (!dashboardReady) return
              router.push(dashboardHref)
            }}
            className={`soft-button rounded-full px-6 py-3 text-sm font-semibold text-white ${
              dashboardReady ? 'bg-[var(--accent-blue)] hover:bg-[#2f59d9]' : 'cursor-not-allowed bg-[#9db4ef] opacity-75'
            }`}
          >
            {dashboardReady
              ? 'ダッシュボードへ進む'
              : profileBootstrapStatus === 'bootstrapping'
                ? 'プロフィールを反映しています'
                : 'ログイン状態を準備しています'}
          </button>
          {!user && (
            <Link
              href="/login"
              className="soft-button rounded-full bg-white px-6 py-3 text-sm font-semibold text-[var(--accent-blue)] ring-1 ring-[var(--line-soft)]"
            >
              ログイン画面へ
            </Link>
          )}
        </div>
        <p className="mt-4 text-xs leading-6 text-[var(--text-sub)]">
          自動で画面が切り替わらない場合は、上のボタンから手動でダッシュボードへ進めます。
        </p>
      </section>
    </div>
  )
}
