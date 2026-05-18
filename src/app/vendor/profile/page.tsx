'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { compressImageFile } from '@/lib/client-image'
import { ApiClientError, fetchApi } from '@/lib/api-client'
import { notifyProfileUpdated } from '@/lib/profile-sync'
import { useDraftForm } from '@/lib/use-draft-form'
import { useSubmissionFeedback } from '@/lib/use-submission-feedback'
import { VENDOR_GENRE_OPTIONS } from '@/lib/vendor-genres'
import type { VendorProfile } from '@/types/marketplace'

export default function VendorProfilePage() {
  const router = useRouter()
  const { refreshProfile } = useAuth()
  const { form, setForm, hasStoredDraft, clearDraft } = useDraftForm('draft:vendor-profile-form', {
    business_name: '',
    owner_name: '',
    contact_email: '',
    phone: '',
    genre: '',
    main_menu: '',
    logo_image_url: '',
    instagram_url: '',
    x_url: '',
    description: '',
  })
  const [savedProfile, setSavedProfile] = useState<VendorProfile | null>(null)
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
        const data = await fetchApi<VendorProfile | null>('/api/vendor/profile', { cache: 'no-store' })
        setSavedProfile(data)

        if (data && !hasStoredDraft) {
          setForm({
            business_name: data.business_name ?? '',
            owner_name: data.owner_name ?? '',
            contact_email: data.contact_email ?? '',
            phone: data.phone ?? '',
            genre: data.genre ?? '',
            main_menu: data.main_menu ?? '',
            logo_image_url: data.logo_image_url ?? '',
            instagram_url: data.instagram_url ?? '',
            x_url: data.x_url ?? '',
            description: data.description ?? '',
          })
        }
      } catch {
        setError('事業者情報の読み込みに失敗しました')
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [hasStoredDraft, setForm])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    start()

    try {
      await fetchApi<null>('/api/vendor/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      succeed('事業者情報を保存しました')
      clearDraft()
      setSavedProfile({
        business_name: form.business_name,
        owner_name: form.owner_name || null,
        contact_email: form.contact_email || null,
        phone: form.phone || null,
        genre: form.genre || null,
        main_menu: form.main_menu || null,
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

  return (
    <div className="space-y-6">
      <div>
        <div className="badge-blue badge-soft inline-block mb-3">事業者設定</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">事業者情報を整える</h1>
        <p className="text-sm text-gray-500">
          お店の名前や連絡先、メインメニューなどをまとめて管理するページです。
        </p>
      </div>

      <div className="soft-panel p-6">
        {loading ? (
          <p className="text-sm text-gray-500">読み込み中...</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {hasStoredDraft && (
              <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4">
                <p className="text-sm font-semibold text-amber-900">この内容は下書きです。まだ事業者設定には反映されていません。</p>
                <p className="mt-1 text-sm text-amber-800">保存済みの内容を確認したい場合は、下のボタンで戻せます。</p>
                {savedProfile && (
                  <button
                    type="button"
                    onClick={() => {
                      setForm({
                        business_name: savedProfile.business_name ?? '',
                        owner_name: savedProfile.owner_name ?? '',
                        contact_email: savedProfile.contact_email ?? '',
                        phone: savedProfile.phone ?? '',
                        genre: savedProfile.genre ?? '',
                        main_menu: savedProfile.main_menu ?? '',
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
              <h2 className="text-lg font-semibold text-gray-800">ブランドロゴ</h2>
              <p className="mt-1 text-sm text-gray-500">イベント主催者から見たときに、ひと目で分かる画像を登録できます。</p>

              <div className="mt-4 flex flex-wrap items-start gap-4">
                <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-3xl border border-[var(--line-soft)] bg-[#f8fafc]">
                  {form.logo_image_url ? (
                    <img src={form.logo_image_url} alt="ロゴ画像" className="h-full w-full object-cover" />
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
                  <p className="mt-2 text-xs text-gray-500">アップロード時に自動で圧縮して保存します。ロゴや看板画像がおすすめです。</p>
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

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">事業者名</label>
                <input
                  value={form.business_name}
                  onChange={(event) => setForm((prev) => ({ ...prev, business_name: event.target.value }))}
                  className="w-full px-4 py-3"
                  placeholder="例: 匠 Soup Curry"
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">担当者名</label>
                <input
                  value={form.owner_name}
                  onChange={(event) => setForm((prev) => ({ ...prev, owner_name: event.target.value }))}
                  className="w-full px-4 py-3"
                  placeholder="例: 菊池 勇樹"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">連絡用メール</label>
                <input
                  type="email"
                  value={form.contact_email}
                  onChange={(event) => setForm((prev) => ({ ...prev, contact_email: event.target.value }))}
                  className="w-full px-4 py-3"
                  placeholder="例: foodtruck@example.com"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">電話番号</label>
                <input
                  value={form.phone}
                  onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                  className="w-full px-4 py-3"
                  placeholder="例: 090-1234-5678"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">ジャンル</label>
              <select
                value={form.genre}
                onChange={(event) => setForm((prev) => ({ ...prev, genre: event.target.value }))}
                className="w-full px-4 py-3"
              >
                <option value="">選択してください</option>
                {VENDOR_GENRE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-gray-500">将来的な主催者検索やスカウトのために使う情報です。</p>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">メインメニュー</label>
              <input
                value={form.main_menu}
                onChange={(event) => setForm((prev) => ({ ...prev, main_menu: event.target.value }))}
                className="w-full px-4 py-3"
                placeholder="例: 匠スペシャル / とろとろ牛すじ"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Instagram アカウントURL</label>
                <input
                  type="url"
                  value={form.instagram_url}
                  onChange={(event) => setForm((prev) => ({ ...prev, instagram_url: event.target.value }))}
                  className="w-full px-4 py-3"
                  placeholder="例: https://www.instagram.com/your_account/"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">X アカウントURL</label>
                <input
                  type="url"
                  value={form.x_url}
                  onChange={(event) => setForm((prev) => ({ ...prev, x_url: event.target.value }))}
                  className="w-full px-4 py-3"
                  placeholder="例: https://x.com/your_account"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">紹介文</label>
              <textarea
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                className="w-full min-h-[140px] px-4 py-3"
                placeholder="お店の特徴や、こだわりを書いておけます。"
              />
            </div>

            {error && <p className="alert-danger px-4 py-3 text-sm text-red-700">{error}</p>}
            {message && <p className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">{message}</p>}

            <button
              type="submit"
              disabled={saving}
              className="soft-button w-full rounded-full bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
            >
              {saving ? '保存中...' : '事業者情報を保存する'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
