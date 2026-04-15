'use client'

import { useState } from 'react'
import { useAuth } from '@/components/AuthProvider'

type AuthMode = 'signin' | 'signup'

export default function LoginPage() {
  const { supabase, loading } = useAuth()
  const [mode, setMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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

      if (mode === 'signin') {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (signInError) {
          throw signInError
        }

        setMessage('ログインしました。ホームへ移動します。')
      } else {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        })

        if (signUpError) {
          throw signUpError
        }

        setMessage('アカウントを作成しました。確認メールが届いた場合は、メールの案内に沿って進めてください。')
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
          <span className="badge-soft badge-blue">キッチンカー向け</span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-[var(--text-main)]">
            売上と営業予定を、ひとつの画面で管理できます
          </h1>
          <p className="mt-4 text-sm leading-7 text-[var(--text-sub)]">
            売上CSVの取り込み、出店場所の整理、営業予測、分析までをひとまとめにした業務アプリです。
            まずはログインして、ご自身のデータだけが見える状態で使い始めましょう。
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              ['1', '売上データ取込', 'AirレジのCSVを入れるだけで日々の数字を整理します。'],
              ['2', '営業予定と予測', 'カレンダー画像から翌月予定を作り、予測までつなげます。'],
              ['3', '分析とふり返り', '場所・曜日・商品ごとの見え方を比較できます。'],
            ].map(([step, title, description]) => (
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
              onClick={() => setMode('signin')}
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
              onClick={() => setMode('signup')}
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
              : 'メールアドレスとパスワードでアカウントを作成します。'}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-[var(--text-main)]">メールアドレス</label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
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
                onChange={(event) => setPassword(event.target.value)}
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
