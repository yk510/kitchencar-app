'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { BRAND_CONCEPT, BRAND_NAME, BRAND_STAGE_LABEL } from '@/lib/brand'
import { compressImageFile } from '@/lib/client-image'
import { ApiClientError, fetchApi } from '@/lib/api-client'
import { notifyProfileUpdated } from '@/lib/profile-sync'
import { useDraftForm } from '@/lib/use-draft-form'
import { useSubmissionFeedback } from '@/lib/use-submission-feedback'
import { type AppRole } from '@/lib/user-role'
import { getVendorGenreLabel, VENDOR_GENRE_OPTIONS } from '@/lib/vendor-genres'

type CopyField = 'description'

type SignupForm = {
  email: string
  password: string
  business_name: string
  organizer_name: string
  owner_name: string
  contact_name: string
  contact_email: string
  phone: string
  genre: string
  main_menu: string
  description: string
  logo_image_url: string
  instagram_url: string
  x_url: string
  description_note: string
}

type SignupStep = {
  id: number
  title: string
  description: string
  reason: string
}

const INITIAL_FORM: SignupForm = {
  email: '',
  password: '',
  business_name: '',
  organizer_name: '',
  owner_name: '',
  contact_name: '',
  contact_email: '',
  phone: '',
  genre: '',
  main_menu: '',
  description: '',
  logo_image_url: '',
  instagram_url: '',
  x_url: '',
  description_note: '',
}

const VENDOR_STEPS: SignupStep[] = [
  {
    id: 1,
    title: 'アカウントを作る',
    description: 'まずはログインに必要な情報だけを入力します。',
    reason: 'ここでメールとパスワードを決めると、以後の分析データや営業メモがご自身のアカウントにひも付きます。',
  },
  {
    id: 2,
    title: 'お店の基本情報',
    description: '事業者名、担当者名、連絡先、ジャンルを入力します。',
    reason: 'この情報は今後の応募や、将来的な主催者検索・スカウトの土台になるので、最初にしっかり持っておきます。',
  },
  {
    id: 3,
    title: 'プロフィールを充実させる',
    description: '主なメニュー、紹介文、ロゴ、SNSなどを入力します。',
    reason: '任意項目ですが、入っているほど相手に雰囲気や強みが伝わり、登録後の活用が広がります。',
  },
]

const ORGANIZER_STEPS: SignupStep[] = [
  {
    id: 1,
    title: 'アカウントを作る',
    description: 'まずはログインに必要な情報だけを入力します。',
    reason: 'ここでメールとパスワードを決めると、募集や応募管理がこの主催者アカウントにひも付きます。',
  },
  {
    id: 2,
    title: '主催者の基本情報',
    description: '主催者名、担当者名、連絡先を入力します。',
    reason: '募集ページや応募対応の信頼感に直結するので、相手に安心してもらえる土台をここで作ります。',
  },
  {
    id: 3,
    title: '主催者プロフィールを充実させる',
    description: '紹介文、ロゴ、SNSなどを入力します。',
    reason: 'どんな想いで開催しているかまで伝わると、応募率や応募の質が上がりやすくなります。',
  },
]

function countFilled(values: string[]) {
  return values.filter((value) => value.trim()).length
}

function validatePassword(password: string) {
  if (!password.trim()) {
    return 'パスワードを入力してください'
  }

  if (password !== password.trim()) {
    return 'パスワードの先頭や末尾にスペースは入れられません'
  }

  if (password.length < 8) {
    return 'パスワードは8文字以上で入力してください'
  }

  if (!/^[\x21-\x7E]+$/.test(password)) {
    return 'パスワードは8文字以上の半角英数字・記号で入力してください'
  }

  return null
}

function normalizeSignupErrorMessage(message: string) {
  const lower = message.toLowerCase()

  if (lower.includes('signup requires a valid password')) {
    return 'パスワードは8文字以上の半角英数字・記号で入力してください。'
  }

  if (lower.includes('password should be at least')) {
    return 'パスワードは8文字以上で入力してください。'
  }

  if (lower.includes('user already registered')) {
    return 'このメールアドレスはすでに登録されています。ログイン画面からお試しください。'
  }

  if (lower.includes('email rate limit exceeded')) {
    return '確認メールの送信上限に達しました。すでに届いている確認メールをご確認ください。'
  }

  return message
}

function isRecoverableSignupError(message: string) {
  const lower = message.toLowerCase()
  return (
    lower.includes('signup requires a valid password') ||
    lower.includes('user already registered') ||
    lower.includes('email rate limit exceeded')
  )
}

function buildVendorWelcomePath(source?: string | null, returnOfferId?: string | null) {
  const params = new URLSearchParams()
  if (source) params.set('from', source)
  if (returnOfferId) params.set('offer', returnOfferId)
  const query = params.toString()
  return query ? `/vendor/welcome?${query}` : '/vendor/welcome'
}

function CopyAssistBlock({
  role,
  field,
  note,
  onNoteChange,
  onGenerate,
  generating,
  disabled,
}: {
  role: AppRole
  field: CopyField
  note: string
  onNoteChange: (value: string) => void
  onGenerate: () => Promise<void>
  generating: boolean
  disabled: boolean
}) {
  const title =
    role === 'vendor'
      ? 'AIで事業者紹介文のたたき台を作る'
      : 'AIで主催者紹介文のたたき台を作る'

  const placeholder =
    role === 'vendor'
      ? '例: 茨城県内で出店。看板商品はスープカレー。ファミリー向けイベントとの相性が良い'
      : '例: 地域の賑わいづくりが目的。家族連れが多く、地元密着のイベントを定期開催している'

  return (
    <div className="mt-3 rounded-3xl border border-dashed border-[var(--line-soft)] bg-[#f9fbff] p-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm font-semibold text-[var(--text-main)]">{title}</p>
        <button
          type="button"
          onClick={() => void onGenerate()}
          disabled={generating || disabled}
          className="soft-button rounded-full bg-white px-4 py-2 text-xs font-semibold text-[var(--accent-blue)] ring-1 ring-[var(--line-soft)] disabled:opacity-50"
        >
          {generating ? '作成中...' : 'AIで下書きを作る'}
        </button>
      </div>
      <p className="mt-2 text-xs leading-6 text-[var(--text-sub)]">
        箇条書きでも大丈夫です。AIに伝えたい特徴や想いを一言メモしておくと、たたき台が作りやすくなります。
      </p>
      <textarea
        value={note}
        onChange={(event) => onNoteChange(event.target.value)}
        className="mt-3 min-h-[88px] w-full px-4 py-3"
        placeholder={placeholder}
      />
    </div>
  )
}

export default function RoleSignupPage({
  role,
  source,
  returnOfferId,
}: {
  role: AppRole
  source?: string | null
  returnOfferId?: string | null
}) {
  const router = useRouter()
  const { supabase, user, hasProfile, refreshProfile } = useAuth()
  const { form, setForm, clearDraft } = useDraftForm(`draft:signup-${role}-form`, INITIAL_FORM)
  const { pending, message, error, setError, setMessage, start, stop } = useSubmissionFeedback()
  const [generatingField, setGeneratingField] = useState<CopyField | null>(null)
  const [step, setStep] = useState(1)
  const [confirmationEmailSent, setConfirmationEmailSent] = useState(false)
  const [confirmationCode, setConfirmationCode] = useState('')
  const [confirmationEmail, setConfirmationEmail] = useState('')

  const isVendor = role === 'vendor'
  const isCompletingExistingAccount = !!user && !hasProfile
  const steps = isVendor ? VENDOR_STEPS : ORGANIZER_STEPS
  const currentStep = steps[step - 1]
  const totalSteps = steps.length

  const requiredCount = isVendor ? 7 : 6

  const requiredFilled = useMemo(
    () =>
      countFilled(
        isVendor
          ? [
              form.email,
              form.password,
              form.business_name,
              form.owner_name,
              form.contact_email,
              form.phone,
              form.genre,
            ]
          : [
              form.email,
              form.password,
              form.organizer_name,
              form.contact_name,
              form.contact_email,
              form.phone,
            ]
      ),
    [form, isVendor]
  )

  const optionalFilled = useMemo(
    () =>
      countFilled(
        isVendor
          ? [form.main_menu, form.description, form.instagram_url, form.x_url, form.logo_image_url]
          : [form.description, form.instagram_url, form.x_url, form.logo_image_url]
      ),
    [form, isVendor]
  )

  const completionPercent = Math.min(
    100,
    Math.round(((requiredFilled + optionalFilled * 0.45) / (requiredCount + 5 * 0.45)) * 100)
  )

  useEffect(() => {
    if (!user?.email) return

    setForm((prev) => {
      if (prev.email === user.email) return prev
      return {
        ...prev,
        email: user.email ?? prev.email,
      }
    })
  }, [setForm, user?.email])

  function validateCurrentStep() {
    if (step === 1) {
      if (isCompletingExistingAccount) return null
      if (!form.email.trim()) return 'メールアドレスを入力してください'
      const passwordError = validatePassword(form.password)
      if (passwordError) return passwordError
      return null
    }

    if (step === 2) {
      if (isVendor) {
        if (!form.business_name.trim()) return '事業者名を入力してください'
        if (!form.owner_name.trim()) return '担当者名を入力してください'
        if (!form.contact_email.trim()) return '連絡用メールを入力してください'
        if (!form.phone.trim()) return '電話番号を入力してください'
        if (!form.genre.trim()) return 'ジャンルを選択してください'
        return null
      }

      if (!form.organizer_name.trim()) return '主催者名を入力してください'
      if (!form.contact_name.trim()) return '担当者名を入力してください'
      if (!form.contact_email.trim()) return '連絡用メールを入力してください'
      if (!form.phone.trim()) return '電話番号を入力してください'
    }

    return null
  }

  function goNext() {
    const validationError = validateCurrentStep()
    if (validationError) {
      setError(validationError)
      return
    }

    setError(null)
    setConfirmationEmailSent(false)
    setStep((prev) => Math.min(totalSteps, prev + 1))
  }

  function goBack() {
    setError(null)
    setConfirmationEmailSent(false)
    setStep((prev) => Math.max(1, prev - 1))
  }

  function handleFormKeyDown(event: React.KeyboardEvent<HTMLFormElement>) {
    if (event.key !== 'Enter') return
    if (step >= totalSteps) return

    const target = event.target as HTMLElement | null
    if (target?.tagName === 'TEXTAREA') return

    event.preventDefault()
    goNext()
  }

  async function handleLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const compressed = await compressImageFile(file, {
        maxWidth: 800,
        maxHeight: 800,
        quality: 0.82,
      })
      setForm((prev) => ({ ...prev, logo_image_url: compressed }))
    } catch {
      setError('画像の読み込みに失敗しました')
    } finally {
      event.target.value = ''
    }
  }

  async function handleGenerate(field: CopyField) {
    setGeneratingField(field)
    setError(null)
    setConfirmationEmailSent(false)

    try {
      const data = await fetchApi<{ text: string }>('/api/onboarding/copy-assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          field,
          name: isVendor ? form.business_name : form.organizer_name,
          genreLabel: isVendor ? getVendorGenreLabel(form.genre || null) : null,
          mainMenu: form.main_menu,
          description: form.description,
          notes: form.description_note,
        }),
      })

      setForm((prev) => ({
        ...prev,
        [field]: data.text,
      }))
    } catch (assistError) {
      setError(
        assistError instanceof ApiClientError
          ? assistError.message
          : 'AIの下書き作成に失敗しました'
      )
    } finally {
      setGeneratingField(null)
    }
  }

  async function finalizeConfirmedSignup(confirmedUser: { id: string }, email: string) {
    if (!supabase) {
      throw new Error('登録機能の準備中です。少し待ってからもう一度お試しください。')
    }

    const signupSource = source ?? null
    const displayName = isVendor ? form.business_name.trim() : form.organizer_name.trim()

    const { error: profileError } = await (supabase as any)
      .from('user_profiles')
      .upsert([{ user_id: confirmedUser.id, role, display_name: displayName }], {
        onConflict: 'user_id',
      })

    if (profileError) {
      throw new Error(profileError.message)
    }

    if (isVendor) {
      const { error: vendorError } = await (supabase as any)
        .from('vendor_profiles')
        .upsert(
          [
            {
              user_id: confirmedUser.id,
              business_name: form.business_name.trim(),
              owner_name: form.owner_name.trim() || null,
              contact_email: form.contact_email.trim() || email,
              phone: form.phone.trim() || null,
              genre: form.genre || null,
              main_menu: form.main_menu.trim() || null,
              logo_image_url: form.logo_image_url || null,
              instagram_url: form.instagram_url.trim() || null,
              x_url: form.x_url.trim() || null,
              description: form.description.trim() || null,
            },
          ],
          { onConflict: 'user_id' }
        )

      if (vendorError) {
        throw new Error(vendorError.message)
      }
    } else {
      const { error: organizerError } = await (supabase as any)
        .from('organizer_profiles')
        .upsert(
          [
            {
              user_id: confirmedUser.id,
              organizer_name: form.organizer_name.trim(),
              contact_name: form.contact_name.trim() || null,
              contact_email: form.contact_email.trim() || email,
              phone: form.phone.trim() || null,
              logo_image_url: form.logo_image_url || null,
              instagram_url: form.instagram_url.trim() || null,
              x_url: form.x_url.trim() || null,
              description: form.description.trim() || null,
            },
          ],
          { onConflict: 'user_id' }
        )

      if (organizerError) {
        throw new Error(organizerError.message)
      }
    }

    clearDraft()
    setConfirmationEmailSent(false)
    setConfirmationCode('')
    setConfirmationEmail('')
    await refreshProfile()
    notifyProfileUpdated()
    router.replace(
      role === 'organizer'
        ? `/organizer/welcome${signupSource ? `?from=${encodeURIComponent(signupSource)}` : ''}`
        : buildVendorWelcomePath(signupSource, returnOfferId)
    )
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (confirmationEmailSent) {
      return
    }

    const validationError = validateCurrentStep()
    if (validationError) {
      setError(validationError)
      return
    }

    start()

    try {
      if (!supabase) {
        throw new Error('登録機能の準備中です。少し待ってからもう一度お試しください。')
      }

      const email = form.email.trim()
      const password = form.password
      const onboardingProfile = isVendor
        ? {
            business_name: form.business_name.trim(),
            owner_name: form.owner_name.trim(),
            contact_email: form.contact_email.trim() || email,
            phone: form.phone.trim(),
            genre: form.genre,
            main_menu: form.main_menu.trim(),
            logo_image_url: form.logo_image_url || null,
            instagram_url: form.instagram_url.trim() || null,
            x_url: form.x_url.trim() || null,
            description: form.description.trim(),
          }
        : {
            organizer_name: form.organizer_name.trim(),
            contact_name: form.contact_name.trim(),
            contact_email: form.contact_email.trim() || email,
            phone: form.phone.trim(),
            logo_image_url: form.logo_image_url || null,
            instagram_url: form.instagram_url.trim() || null,
            x_url: form.x_url.trim() || null,
            description: form.description.trim(),
          }
      let activeUser = user
      let hasActiveSession = !!user

      let signUpCreatedPending = false
      let recoverableSignUpError: Error | null = null

      if (!activeUser) {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              role,
              display_name: isVendor ? form.business_name.trim() : form.organizer_name.trim(),
              onboarding_profile: onboardingProfile,
            },
          },
        })

        if (signUpError) {
          if (!isRecoverableSignupError(signUpError.message ?? '')) {
            throw signUpError
          }
          recoverableSignUpError = signUpError
        } else {
          activeUser = signUpData.user
          hasActiveSession = !!signUpData.session
          signUpCreatedPending = !!signUpData.user
        }

        if (!hasActiveSession) {
          const signInResult = await supabase.auth.signInWithPassword({ email, password })
          if (!signInResult.error && signInResult.data.user) {
            activeUser = signInResult.data.user
            hasActiveSession = true
          } else if (recoverableSignUpError) {
            const recoverableMessage = recoverableSignUpError.message?.toLowerCase() ?? ''
            if (
              recoverableMessage.includes('email rate limit exceeded') ||
              recoverableMessage.includes('user already registered')
            ) {
              if (recoverableMessage.includes('user already registered')) {
                const { error: resendError } = await (supabase.auth as any).resend({
                  type: 'signup',
                  email,
                })

                if (!resendError) {
                  setForm((prev) => ({ ...prev, password: '' }))
                  setMessage(
                    '確認コードを再送しました。メールに届いたコードをこの画面に入力してください。'
                  )
                  setConfirmationEmailSent(true)
                  setConfirmationEmail(email)
                  stop()
                  return
                }

                if (!String(resendError.message ?? '').toLowerCase().includes('rate limit')) {
                  throw resendError
                }
              }

              setForm((prev) => ({ ...prev, password: '' }))
              setMessage(
                '確認コードは送信済みです。再送の上限に達しているため、すでに届いているコードを入力してください。'
              )
              setConfirmationEmailSent(true)
              setConfirmationEmail(email)
              stop()
              return
            }

            throw recoverableSignUpError
          }
        }
      }

      if (activeUser && hasActiveSession) {
        await finalizeConfirmedSignup(activeUser, email)
        return
      }

      setForm((prev) => ({ ...prev, password: '' }))
      if (signUpCreatedPending) {
        setMessage(
          'アカウントを作成しました。メールに届いた確認コードを入力すると、登録を完了できます。'
        )
        setConfirmationEmailSent(true)
        setConfirmationEmail(email)
      }
      stop()
    } catch (submitError) {
      stop()
      setError(
        submitError instanceof Error
          ? normalizeSignupErrorMessage(submitError.message)
          : '登録に失敗しました。時間をおいてもう一度お試しください。'
      )
    }
  }

  async function handleVerifyConfirmationCode() {
    if (!supabase) {
      setError('確認機能の準備中です。少し待ってからもう一度お試しください。')
      return
    }

    const email = confirmationEmail || form.email.trim()
    const code = confirmationCode.trim()

    if (!email) {
      setError('確認コードを送ったメールアドレスが見つかりません。もう一度登録をお試しください。')
      return
    }

    if (!code) {
      setError('確認コードを入力してください。')
      return
    }

    start()

    try {
      const { data, error: verifyError } = await (supabase.auth as any).verifyOtp({
        email,
        token: code,
        type: 'signup',
      })

      if (verifyError) {
        throw verifyError
      }

      const confirmedUser = data?.user
      if (!confirmedUser) {
        throw new Error('確認コードの検証には成功しましたが、ユーザー情報の取得に失敗しました。')
      }

      await refreshProfile()
      setMessage('確認コードを認証しました。登録を完了しています...')
      await finalizeConfirmedSignup(confirmedUser, email)
    } catch (verifyError) {
      stop()
      setError(
        verifyError instanceof Error
          ? normalizeSignupErrorMessage(verifyError.message)
          : '確認コードの検証に失敗しました。'
      )
    }
  }

  async function handleResendConfirmationCode() {
    if (!supabase) {
      setError('確認コード再送の準備中です。少し待ってからもう一度お試しください。')
      return
    }

    const email = confirmationEmail || form.email.trim()
    if (!email) {
      setError('再送先のメールアドレスが見つかりません。')
      return
    }

    start()

    try {
      const { error: resendError } = await (supabase.auth as any).resend({
        type: 'signup',
        email,
      })

      if (resendError) {
        throw resendError
      }

      setMessage('確認コードを再送しました。メールに届いた最新のコードを入力してください。')
      stop()
    } catch (resendError) {
      stop()
      setError(
        resendError instanceof Error
          ? normalizeSignupErrorMessage(resendError.message)
          : '確認コードの再送に失敗しました。'
      )
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="soft-panel rounded-[32px] px-7 py-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="badge-soft badge-blue">{BRAND_NAME}</span>
            <span className="rounded-full bg-[#eef4ff] px-3 py-1 text-[11px] font-semibold tracking-[0.12em] text-[var(--accent-blue)]">
              {BRAND_STAGE_LABEL}
            </span>
          </div>
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-700">
            {isVendor ? 'VENDOR SIGNUP' : 'ORGANIZER SIGNUP'}
          </p>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-[var(--text-main)]">
            {isVendor ? 'キッチンカー事業者として使い始める' : 'イベント主催者として使い始める'}
          </h1>
          <p className="mt-3 text-sm font-semibold text-[var(--accent-blue)]">{BRAND_CONCEPT}</p>
          <p className="mt-4 text-sm leading-7 text-[var(--text-sub)]">
            {isVendor
              ? '入力の負荷を減らすために、少しずつ3ステップで進めます。必須情報から始めて、プロフィールの充実はあとからでも大丈夫です。'
              : '主催者登録も、必要な情報を順番に整理しながら進めます。各画面で「なぜ必要か」を見ながら安心して入力できます。'}
          </p>

          <div className="mt-8 rounded-3xl border border-[var(--line-soft)] bg-white/90 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--text-main)]">登録の進み具合</p>
                <p className="mt-1 text-xs text-[var(--text-sub)]">
                  ステップ進行と入力状況を合わせて表示しています。途中で離れても下書きから再開できます。
                </p>
              </div>
              <span className="rounded-full bg-[var(--accent-blue-soft)] px-3 py-1 text-sm font-bold text-[var(--accent-blue)]">
                {completionPercent}%
              </span>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#edf2f7]">
              <div className="h-full rounded-full bg-[var(--accent-blue)] transition-all" style={{ width: `${completionPercent}%` }} />
            </div>
            <ul className="mt-4 space-y-2 text-sm text-[var(--text-sub)]">
              <li>・基本情報: {requiredFilled} / {requiredCount} 項目入力済み</li>
              <li>・任意項目: {optionalFilled} 項目入力済み</li>
              <li>・AIの下書き補助で、自由記述の負担を軽くできます</li>
            </ul>
          </div>

          <div className="mt-6 space-y-3">
            {steps.map((item) => {
              const active = item.id === step
              const done = item.id < step
              return (
                <div
                  key={item.id}
                  className={`rounded-3xl border p-4 transition-colors ${
                    active
                      ? 'border-[var(--accent-blue)] bg-[var(--accent-blue-soft)]'
                      : done
                        ? 'border-emerald-200 bg-emerald-50'
                        : 'border-[var(--line-soft)] bg-white/90'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                        active
                          ? 'bg-[var(--accent-blue)] text-white'
                          : done
                            ? 'bg-emerald-500 text-white'
                            : 'bg-[#eef2f7] text-[var(--text-sub)]'
                      }`}
                    >
                      {done ? '✓' : item.id}
                    </div>
                    <div>
                      <p className="font-semibold text-[var(--text-main)]">{item.title}</p>
                      <p className="mt-1 text-sm text-[var(--text-sub)]">{item.description}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section className="soft-panel rounded-[32px] px-6 py-7">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm font-semibold text-[var(--accent-blue)]">
                STEP {step} / {totalSteps}
              </p>
              <h2 className="mt-2 text-xl font-bold text-[var(--text-main)]">{currentStep.title}</h2>
              <p className="mt-2 text-sm text-[var(--text-sub)]">{currentStep.description}</p>
            </div>
            <Link href={`/login?role=${role}`} className="text-sm font-semibold text-[var(--accent-blue)]">
              すでにアカウントを持っている
            </Link>
          </div>

          <div className="mt-5 rounded-3xl border border-[var(--line-soft)] bg-[#f8fbff] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">Why This Matters</p>
            <p className="mt-2 text-sm leading-7 text-[var(--text-sub)]">{currentStep.reason}</p>
          </div>

          <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="mt-6 space-y-5">
            {step === 1 && (
              <div className="rounded-3xl border border-[var(--line-soft)] bg-white p-5">
                <h3 className="text-lg font-semibold text-[var(--text-main)]">アカウント情報</h3>
                <p className="mt-1 text-sm text-[var(--text-sub)]">
                  {isCompletingExistingAccount
                    ? 'アカウントは作成済みです。このままプロフィール入力を続けると、登録を完了できます。'
                    : 'ここで作るメールアドレスとパスワードが、今後のログイン情報になります。'}
                </p>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">メールアドレス</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                      className="w-full px-4 py-3"
                      placeholder="you@example.com"
                      disabled={isCompletingExistingAccount}
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">パスワード</label>
                    <input
                      type="password"
                      value={form.password}
                      onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                      className="w-full px-4 py-3"
                      placeholder={
                        isCompletingExistingAccount ? 'アカウント作成済みのため入力不要です' : '8文字以上の半角英数字・記号'
                      }
                      minLength={8}
                      disabled={isCompletingExistingAccount}
                      required
                    />
                    <p className="mt-2 text-xs text-[var(--text-sub)]">
                      {isCompletingExistingAccount
                        ? 'このステップは完了済みです。次へ進んでプロフィール入力を続けてください。'
                        : '8文字以上の半角英数字・記号で入力してください。あとで変更もできます。'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="rounded-3xl border border-[var(--line-soft)] bg-white p-5">
                <h3 className="text-lg font-semibold text-[var(--text-main)]">基本情報</h3>
                <p className="mt-1 text-sm text-[var(--text-sub)]">
                  {isVendor ? '今後の応募や検索の土台になるので、まずはここをしっかり入力します。' : '募集ページや応募対応で、相手に安心してもらうための土台です。'}
                </p>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">{isVendor ? '事業者名' : '主催者名'}</label>
                    <input
                      value={isVendor ? form.business_name : form.organizer_name}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          [isVendor ? 'business_name' : 'organizer_name']: event.target.value,
                        }))
                      }
                      className="w-full px-4 py-3"
                      placeholder={isVendor ? '例: 匠 Soup Curry' : '例: まちなかマルシェ実行委員会'}
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">担当者名</label>
                    <input
                      value={isVendor ? form.owner_name : form.contact_name}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          [isVendor ? 'owner_name' : 'contact_name']: event.target.value,
                        }))
                      }
                      className="w-full px-4 py-3"
                      placeholder="例: 菊池 勇樹"
                      required
                    />
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">連絡用メール</label>
                    <input
                      type="email"
                      value={form.contact_email}
                      onChange={(event) => setForm((prev) => ({ ...prev, contact_email: event.target.value }))}
                      className="w-full px-4 py-3"
                      placeholder="例: info@example.com"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">電話番号</label>
                    <input
                      value={form.phone}
                      onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                      className="w-full px-4 py-3"
                      placeholder="例: 090-1234-5678"
                      required
                    />
                  </div>
                </div>

                {isVendor && (
                  <div className="mt-4 md:max-w-sm">
                    <label className="mb-2 block text-sm font-medium text-gray-700">ジャンル</label>
                    <select
                      value={form.genre}
                      onChange={(event) => setForm((prev) => ({ ...prev, genre: event.target.value }))}
                      className="w-full px-4 py-3"
                      required
                    >
                      <option value="">選択してください</option>
                      {VENDOR_GENRE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <p className="mt-2 text-xs text-[var(--text-sub)]">
                      将来的な主催者検索やスカウトのために使う情報です。
                    </p>
                  </div>
                )}
              </div>
            )}

            {step === 3 && (
              <div className="rounded-3xl border border-[var(--line-soft)] bg-white p-5">
                <h3 className="text-lg font-semibold text-[var(--text-main)]">プロフィールを充実させる</h3>
                <p className="mt-1 text-sm text-[var(--text-sub)]">
                  任意項目です。あとから変更もできますが、先に入れておくほど相手に伝わりやすくなります。
                </p>

                <div className="mt-4">
                  <label className="mb-2 block text-sm font-medium text-gray-700">ロゴ画像（任意）</label>
                  <div className="flex flex-wrap items-start gap-4 rounded-3xl border border-[var(--line-soft)] bg-[#f8fbff] p-4">
                    <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl border border-[var(--line-soft)] bg-white">
                      {form.logo_image_url ? (
                        <img src={form.logo_image_url} alt="ロゴ画像" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-xs text-gray-400">未設定</span>
                      )}
                    </div>
                    <div className="min-w-[220px] flex-1">
                      <input type="file" accept="image/*" onChange={handleLogoChange} className="block w-full text-sm text-gray-600" />
                      <p className="mt-2 text-xs text-[var(--text-sub)]">
                        重い画像は自動で圧縮します。ロゴや看板画像がおすすめです。
                      </p>
                    </div>
                  </div>
                </div>

                {isVendor && (
                  <div className="mt-4">
                    <label className="mb-2 block text-sm font-medium text-gray-700">主なメニュー（任意）</label>
                    <input
                      value={form.main_menu}
                      onChange={(event) => setForm((prev) => ({ ...prev, main_menu: event.target.value }))}
                      className="w-full px-4 py-3"
                      placeholder="例: スープカレー / 牛すじカレー / ラッシー"
                    />
                    <p className="mt-2 text-xs text-[var(--text-sub)]">
                      看板商品や人気メニューを短く入れておくと、主催者に伝わりやすくなります。
                    </p>
                  </div>
                )}

                <div className="mt-4">
                  <label className="mb-2 block text-sm font-medium text-gray-700">紹介文（任意）</label>
                  <textarea
                    value={form.description}
                    onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                    className="min-h-[160px] w-full px-4 py-3"
                    placeholder={
                      isVendor
                        ? 'どんな商品を、どんな想いで、どんな場に届けたいかを書くと相手に伝わりやすくなります。'
                        : 'どんな想いで開催しているか、どんな来場者が多いか、どんなイベントと相性が良いかを書くと応募率が上がりやすくなります。'
                    }
                  />
                  <CopyAssistBlock
                    role={role}
                    field="description"
                    note={form.description_note}
                    onNoteChange={(value) => setForm((prev) => ({ ...prev, description_note: value }))}
                    onGenerate={() => handleGenerate('description')}
                    generating={generatingField === 'description'}
                    disabled={isVendor ? !form.business_name.trim() || !form.genre : !form.organizer_name.trim()}
                  />
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">Instagram URL（任意）</label>
                    <input
                      type="url"
                      value={form.instagram_url}
                      onChange={(event) => setForm((prev) => ({ ...prev, instagram_url: event.target.value }))}
                      className="w-full px-4 py-3"
                      placeholder="https://www.instagram.com/your_account/"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">X URL（任意）</label>
                    <input
                      type="url"
                      value={form.x_url}
                      onChange={(event) => setForm((prev) => ({ ...prev, x_url: event.target.value }))}
                      className="w-full px-4 py-3"
                      placeholder="https://x.com/your_account"
                    />
                  </div>
                </div>
              </div>
            )}

            {error && <p className="alert-danger px-4 py-3 text-sm text-red-700">{error}</p>}
            {message && <p className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</p>}

            {confirmationEmailSent && (
              <div className="rounded-3xl border border-[var(--accent-blue)]/20 bg-[var(--accent-blue-soft)] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-blue)]">
                  Confirm Code
                </p>
                <h3 className="mt-2 text-lg font-semibold text-[var(--text-main)]">メールで届いた確認コードを入力</h3>
                <p className="mt-2 text-sm leading-7 text-[var(--text-sub)]">
                  <span className="font-semibold text-[var(--text-main)]">{confirmationEmail || form.email.trim()}</span>
                  に届いた確認コードを入力すると、そのまま登録完了まで進みます。
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={confirmationCode}
                    onChange={(event) => setConfirmationCode(event.target.value.replace(/\s+/g, ''))}
                    className="w-full px-4 py-3"
                    placeholder="メールに届いた確認コード"
                  />
                  <button
                    type="button"
                    onClick={() => void handleVerifyConfirmationCode()}
                    disabled={pending}
                    className="soft-button rounded-full bg-[var(--accent-blue)] px-6 py-3 text-sm font-semibold text-white hover:bg-[#2f59d9] disabled:opacity-50"
                  >
                    {pending ? '確認中...' : 'コードを確認する'}
                  </button>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                  <button
                    type="button"
                    onClick={() => void handleResendConfirmationCode()}
                    disabled={pending}
                    className="font-semibold text-[var(--accent-blue)] disabled:opacity-50"
                  >
                    コードを再送する
                  </button>
                  <span className="text-[var(--text-sub)]">メールのリンクは使わず、コード入力で進めます。</span>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={goBack}
                disabled={step === 1 || pending}
                className="soft-button rounded-full bg-white px-5 py-3 text-sm font-semibold text-[var(--text-main)] ring-1 ring-[var(--line-soft)] disabled:opacity-40"
              >
                戻る
              </button>

              {step < totalSteps ? (
                <button
                  key={`next-step-${step}`}
                  type="button"
                  onClick={goNext}
                  className="soft-button rounded-full bg-[var(--accent-blue)] px-6 py-3 text-sm font-semibold text-white hover:bg-[#2f59d9]"
                >
                  次へ進む
                </button>
              ) : (
                <button
                  key={`submit-step-${step}`}
                  type="submit"
                  disabled={pending || confirmationEmailSent}
                  className="soft-button rounded-full bg-[var(--accent-blue)] px-6 py-3 text-sm font-semibold text-white hover:bg-[#2f59d9] disabled:opacity-50"
                >
                  {pending
                    ? '登録中...'
                    : confirmationEmailSent
                      ? '確認メールを送信しました'
                      : `${isVendor ? 'キッチンカー事業者' : 'イベント主催者'}として登録する`}
                </button>
              )}
            </div>
          </form>
        </section>
      </div>
    </div>
  )
}
