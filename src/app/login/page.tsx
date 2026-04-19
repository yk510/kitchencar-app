'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { getHostScopeFromWindow, getScopedLoginRole } from '@/lib/domain'
import { usePersistentDraft } from '@/lib/usePersistentDraft'

type AuthMode = 'signin' | 'signup'
type Role = 'vendor' | 'organizer'

export default function LoginPage() {
  const { supabase, loading } = useAuth()
  const hostScope = useMemo(() => getHostScopeFromWindow(), [])
  const lockedRole = getScopedLoginRole(hostScope)
  const authDraft = usePersistentDraft('draft:login-form', {
    mode: 'signin' as AuthMode,
    email: '',
    password: '',
    role: 'vendor' as Role,
    displayName: '',
  })
  const { value: draft, setValue: setDraft, clearDraft } = authDraft
  const { mode, email, password, role, displayName } = draft
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!lockedRole) return
    if (draft.role === lockedRole) return
    setDraft((prev) => ({ ...prev, role: lockedRole }))
  }, [draft.role, lockedRole, setDraft])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setMessage(null)
    setError(null)

    try {
      if (!supabase) {
        throw new Error('ログイン機能の準備中です。少し待ってからもう一度お試しください。')
      }

      if (mode === 'signin') {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (signInError) {
          throw signInError
        }

        setMessage('ログインしました。ホームへ移動します。')
        clearDraft()
      } else {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              role,
              display_name: displayName.trim() || null,
            },
          },
        })

        if (signUpError) {
          throw signUpError
        }

        setMessage('アカウントを作成しました。確認メールが届いた場合は、メールの案内に沿って進めてください。')
        clearDraft()
      }
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
          <span className="badge-soft badge-blue">
            {hostScope === 'organizer' ? 'イベント主催者向け' : 'キッチンカー向け'}
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-[var(--text-main)]">
            {hostScope === 'organizer'
              ? '募集作成と応募管理を、ひとつの画面で進められます'
              : '売上と営業予定を、ひとつの画面で管理できます'}
          </h1>
          <p className="mt-4 text-sm leading-7 text-[var(--text-sub)]">
            {hostScope === 'organizer'
              ? 'イベント主催者向けの入口です。募集作成、応募確認、主催者プロフィール管理を、主催者専用の導線で進められます。'
              : '売上CSVの取り込み、出店場所の整理、営業予測、分析までをひとまとめにした業務アプリです。まずはログインして、ご自身のデータだけが見える状態で使い始めましょう。'}
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {(hostScope === 'organizer'
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
          <div className="flex rounded-full bg-[var(--bg-main)] p-1">
            <button
              type="button"
              onClick={() => setDraft((prev) => ({ ...prev, mode: 'signin' }))}
              className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold ${
                mode === 'signin'
                  ? 'bg-white text-[var(--accent-blue)] shadow-sm'
                  : 'text-[var(--text-sub)]'
              }`}
            >
              ログイン
            </button>
            <button
              type="button"
              onClick={() => setDraft((prev) => ({ ...prev, mode: 'signup' }))}
              className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold ${
                mode === 'signup'
                  ? 'bg-white text-[var(--accent-blue)] shadow-sm'
                  : 'text-[var(--text-sub)]'
              }`}
            >
              新規登録
            </button>
          </div>

          <h2 className="mt-6 text-xl font-bold text-[var(--text-main)]">
            {mode === 'signin' ? 'アカウントにログイン' : 'はじめて使う'}
          </h2>
          <p className="mt-2 text-sm text-[var(--text-sub)]">
            {mode === 'signin'
              ? '登録したメールアドレスとパスワードを入力してください。'
              : 'メールアドレス、パスワード、利用者区分を選んでアカウントを作成します。'}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {mode === 'signup' && !lockedRole && (
              <>
                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--text-main)]">利用者区分</label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setDraft((prev) => ({ ...prev, role: 'vendor' }))}
                      className={`rounded-2xl border px-4 py-4 text-left ${
                        role === 'vendor'
                          ? 'border-[var(--accent-blue)] bg-[var(--accent-blue-soft)]'
                          : 'border-[var(--line-soft)] bg-white'
                      }`}
                    >
                      <p className="font-semibold text-[var(--text-main)]">キッチンカー事業者</p>
                      <p className="mt-1 text-sm text-[var(--text-sub)]">募集を見る、質問する、応募する</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDraft((prev) => ({ ...prev, role: 'organizer' }))}
                      className={`rounded-2xl border px-4 py-4 text-left ${
                        role === 'organizer'
                          ? 'border-[var(--accent-blue)] bg-[var(--accent-blue-soft)]'
                          : 'border-[var(--line-soft)] bg-white'
                      }`}
                    >
                      <p className="font-semibold text-[var(--text-main)]">イベント主催者</p>
                      <p className="mt-1 text-sm text-[var(--text-sub)]">募集を作る、応募を確認する</p>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-[var(--text-main)]">表示名（任意）</label>
                  <input
                    value={displayName}
                    onChange={(event) => setDraft((prev) => ({ ...prev, displayName: event.target.value }))}
                    className="w-full px-4 py-3"
                    placeholder="例: 匠 Soup Curry / まちなかマルシェ実行委員会"
                  />
                </div>
              </>
            )}

            {mode === 'signup' && lockedRole && (
              <div className="rounded-2xl border border-[var(--line-soft)] bg-[var(--bg-main)] px-4 py-4">
                <p className="text-sm font-semibold text-[var(--text-main)]">利用者区分</p>
                <p className="mt-1 text-sm text-[var(--text-sub)]">
                  {lockedRole === 'organizer'
                    ? 'このサブドメインでは、イベント主催者アカウントを作成します。'
                    : 'このサブドメインでは、キッチンカー事業者アカウントを作成します。'}
                </p>
              </div>
            )}

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
              disabled={submitting || loading || !supabase}
              className="w-full rounded-full bg-[var(--accent-blue)] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting
                ? '処理しています...'
                : loading || !supabase
                  ? '準備しています...'
                : mode === 'signin'
                  ? 'ログインする'
                  : 'アカウントを作成する'}
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}
