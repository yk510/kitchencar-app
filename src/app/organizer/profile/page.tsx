'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { compressImageFile } from '@/lib/client-image'
import { ApiClientError, fetchApi } from '@/lib/api-client'
import { notifyProfileUpdated } from '@/lib/profile-sync'
import { useDraftForm } from '@/lib/use-draft-form'
import { useSubmissionFeedback } from '@/lib/use-submission-feedback'
import type { OrganizerProfile } from '@/types/marketplace'

export default function OrganizerProfilePage() {
  const router = useRouter()
  const { refreshProfile } = useAuth()
  const { form, setForm, hasStoredDraft, clearDraft } = useDraftForm('draft:organizer-profile-form', {
    organizer_name: '',
    contact_name: '',
    contact_email: '',
    phone: '',
    logo_image_url: '',
    instagram_url: '',
    x_url: '',
    description: '',
  })
  const [savedProfile, setSavedProfile] = useState<OrganizerProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const {
    pending: saving,
    message,
    error,
    setError,
    start,
    succeed,
    stop,
    reset,
  } = useSubmissionFeedback()

  useEffect(() => {
    async function load() {
      try {
        const data = await fetchApi<OrganizerProfile | null>('/api/organizer/profile', { cache: 'no-store' })
        setSavedProfile(data)

        if (data && !hasStoredDraft) {
          setForm({
            organizer_name: data.organizer_name ?? '',
            contact_name: data.contact_name ?? '',
            contact_email: data.contact_email ?? '',
            phone: data.phone ?? '',
            logo_image_url: data.logo_image_url ?? '',
            instagram_url: data.instagram_url ?? '',
            x_url: data.x_url ?? '',
            description: data.description ?? '',
          })
        }
      } catch {
        setError('主催者情報の読み込みに失敗しました')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [hasStoredDraft, setForm])

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
      setError('ロゴ画像の読み込みに失敗しました')
    } finally {
      event.target.value = ''
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    start()

    try {
      await fetchApi<null>('/api/organizer/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      succeed('主催者情報を保存しました')
      clearDraft()
      setSavedProfile({
        organizer_name: form.organizer_name,
        contact_name: form.contact_name || null,
        contact_email: form.contact_email || null,
        phone: form.phone || null,
        logo_image_url: form.logo_image_url || null,
        instagram_url: form.instagram_url || null,
        x_url: form.x_url || null,
        description: form.description || null,
      })
      await refreshProfile()
      notifyProfileUpdated()
      router.refresh()
    } catch (err) {
      stop()
      setError(err instanceof ApiClientError ? err.message : '通信エラーが発生しました')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="badge-blue badge-soft inline-block mb-3">主催者設定</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">主催者情報を整える</h1>
        <p className="text-sm text-gray-500">
          ベンダーが「この主催者なら安心して応募できそう」と感じられるように、主催者の顔が見えるプロフィールを整えるページです。
        </p>
      </div>

      <div className="soft-panel p-6">
        <div className="grid gap-3 lg:grid-cols-4">
          <div className="rounded-2xl bg-white/80 border border-white px-4 py-3">
            <p className="text-xs text-gray-500 mb-1">POINT 1</p>
            <p className="font-medium text-gray-800">誰が主催しているか</p>
            <p className="mt-1 text-xs text-gray-500">団体名、担当者、ロゴが見えると安心感が上がります。</p>
          </div>
          <div className="rounded-2xl bg-white/80 border border-white px-4 py-3">
            <p className="text-xs text-gray-500 mb-1">POINT 2</p>
            <p className="font-medium text-gray-800">連絡先が分かる</p>
            <p className="mt-1 text-xs text-gray-500">メールや電話番号があると、出店者は不安を感じにくくなります。</p>
          </div>
          <div className="rounded-2xl bg-white/80 border border-white px-4 py-3">
            <p className="text-xs text-gray-500 mb-1">POINT 3</p>
            <p className="font-medium text-gray-800">SNSで雰囲気が伝わる</p>
            <p className="mt-1 text-xs text-gray-500">過去開催の空気感や実績が見えると、応募意欲が高まりやすくなります。</p>
          </div>
          <div className="rounded-2xl bg-white/80 border border-white px-4 py-3">
            <p className="text-xs text-gray-500 mb-1">POINT 4</p>
            <p className="font-medium text-gray-800">紹介文が応募率を左右する</p>
            <p className="mt-1 text-xs text-gray-500">どんな想いで開催しているかまで伝えるのがおすすめです。</p>
          </div>
        </div>
      </div>

      <div className="soft-panel p-6">
        {loading ? (
          <p className="text-sm text-gray-500">読み込み中...</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {hasStoredDraft && (
              <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4">
                <p className="text-sm font-semibold text-amber-900">この内容は下書きです。まだ募集詳細には反映されていません。</p>
                <p className="mt-1 text-sm text-amber-800">募集詳細に反映させるには、この画面で保存を完了してください。</p>
                {savedProfile && (
                  <button
                    type="button"
                    onClick={() => {
                      setForm({
                        organizer_name: savedProfile.organizer_name ?? '',
                        contact_name: savedProfile.contact_name ?? '',
                        contact_email: savedProfile.contact_email ?? '',
                        phone: savedProfile.phone ?? '',
                        logo_image_url: savedProfile.logo_image_url ?? '',
                        instagram_url: savedProfile.instagram_url ?? '',
                        x_url: savedProfile.x_url ?? '',
                        description: savedProfile.description ?? '',
                      })
                      clearDraft()
                      reset()
                    }}
                    className="mt-3 rounded-full bg-white px-4 py-2 text-sm font-semibold text-amber-900 ring-1 ring-amber-200"
                  >
                    保存済みの内容に戻す
                  </button>
                )}
              </div>
            )}

            <div className="rounded-3xl border border-[var(--line-soft)] bg-white p-5">
              <h2 className="text-lg font-semibold text-gray-800">主催者ロゴ</h2>
              <p className="mt-1 text-sm text-gray-500">イベントや団体の印象が伝わるロゴやシンボル画像を登録できます。</p>

              <div className="mt-4 flex flex-wrap items-start gap-4">
                <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-3xl border border-[var(--line-soft)] bg-[#f8fafc]">
                  {form.logo_image_url ? (
                    <img src={form.logo_image_url} alt="主催者ロゴ" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs text-gray-400">未設定</span>
                  )}
                </div>
                <div className="min-w-[220px] flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="block w-full text-sm text-gray-600"
                  />
                  <p className="mt-2 text-xs text-gray-500">アップロード時に自動で圧縮して保存します。ロゴやイベントバナーの一部がおすすめです。</p>
                  {form.logo_image_url && (
                    <button
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, logo_image_url: '' }))}
                      className="mt-3 rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600"
                    >
                      ロゴ画像を削除
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-[var(--line-soft)] bg-white p-5">
              <h2 className="text-lg font-semibold text-gray-800">主催者の基本情報</h2>
              <p className="mt-1 text-sm text-gray-500">応募前にベンダーが必ず見る、いちばん大事な情報です。</p>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">主催者名</label>
                  <input
                    value={form.organizer_name}
                    onChange={(event) => setForm((prev) => ({ ...prev, organizer_name: event.target.value }))}
                    className="w-full px-4 py-3"
                    placeholder="例: まちなかマルシェ実行委員会"
                    required
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">担当者名</label>
                  <input
                    value={form.contact_name}
                    onChange={(event) => setForm((prev) => ({ ...prev, contact_name: event.target.value }))}
                    className="w-full px-4 py-3"
                    placeholder="例: 山田 花子"
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
                    placeholder="例: event@example.com"
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
            </div>

            <div className="rounded-3xl border border-[var(--line-soft)] bg-white p-5">
              <h2 className="text-lg font-semibold text-gray-800">SNS・外部情報</h2>
              <p className="mt-1 text-sm text-gray-500">過去開催の様子や主催者の雰囲気が伝わると、応募意欲が上がりやすくなります。</p>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Instagram URL（任意）</label>
                  <input
                    type="url"
                    value={form.instagram_url}
                    onChange={(event) => setForm((prev) => ({ ...prev, instagram_url: event.target.value }))}
                    className="w-full px-4 py-3"
                    placeholder="例: https://www.instagram.com/your_account/"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">X URL（任意）</label>
                  <input
                    type="url"
                    value={form.x_url}
                    onChange={(event) => setForm((prev) => ({ ...prev, x_url: event.target.value }))}
                    className="w-full px-4 py-3"
                    placeholder="例: https://x.com/your_account"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-[var(--line-soft)] bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">紹介文</h2>
                  <p className="mt-1 text-sm text-gray-500">「どんな主催者なのか」が伝わるほど、ベンダーは安心して応募しやすくなります。</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${form.description.trim().length >= 80 ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                  {form.description.trim().length} 文字 / 80文字以上がおすすめ
                </span>
              </div>

              <div className="mt-4 rounded-2xl bg-[#f8fafc] p-4 text-sm text-gray-600">
                <p className="font-medium text-gray-800">書くと伝わりやすいポイント</p>
                <ul className="mt-2 space-y-1">
                  <li>・どんな想いでイベントを開催しているか</li>
                  <li>・来場者の雰囲気や客層</li>
                  <li>・過去開催実績や継続開催の有無</li>
                  <li>・キッチンカーに期待していること</li>
                </ul>
              </div>

              <div className="mt-4">
                <label className="mb-2 block text-sm font-medium text-gray-700">紹介文</label>
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                  className="w-full min-h-[220px] px-4 py-3"
                  placeholder="例: 私たちは地域の家族連れが集まる屋外イベントを毎月開催しています。来場者は30代〜40代のファミリー層が中心で、滞在時間も比較的長めです。キッチンカーの皆さまには、来場者がイベントをより楽しめるような食体験をご一緒いただきたいと考えています。"
                  required
                />
              </div>
            </div>

            {error && <p className="alert-danger px-4 py-3 text-sm text-red-700">{error}</p>}
            {message && <p className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</p>}

            <button
              type="submit"
              disabled={saving}
              className="soft-button w-full rounded-full bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
            >
              {saving ? '保存中...' : '主催者情報を保存する'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
