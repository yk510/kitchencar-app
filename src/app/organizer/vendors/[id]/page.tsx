'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

type VendorPublicProfile = {
  user_id: string
  business_name: string
  owner_name: string | null
  main_menu: string | null
  logo_image_url: string | null
  instagram_url: string | null
  x_url: string | null
  description: string | null
}

export default function OrganizerVendorDetailPage({ params }: { params: { id: string } }) {
  const [profile, setProfile] = useState<VendorPublicProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadProfile() {
    try {
      const res = await fetch(`/api/organizer/vendors/${params.id}`, { cache: 'no-store' })
      const json = await res.json()

      if (!res.ok) {
        setError(json.error ?? 'ベンダー情報の取得に失敗しました')
        return
      }

      setProfile(json.data ?? null)
      setError(null)
    } catch {
      setError('ベンダー情報の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadProfile()
  }, [params.id])

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadProfile()
    }, 15000)

    return () => window.clearInterval(timer)
  }, [params.id])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="badge-blue badge-soft inline-block mb-3">ベンダー詳細</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">ベンダー情報</h1>
          <p className="text-sm text-gray-500">事業者設定で登録された公開プロフィールを確認できます。</p>
        </div>
        <Link
          href="/organizer/applications"
          className="rounded-full bg-white px-4 py-2 text-sm text-[var(--accent-blue)] ring-1 ring-[var(--line-soft)]"
        >
          応募管理へ戻る
        </Link>
      </div>

      <div className="soft-panel p-6">
        {loading ? (
          <p className="text-sm text-gray-500">読み込み中...</p>
        ) : error ? (
          <p className="alert-danger px-4 py-3 text-sm text-red-700">{error}</p>
        ) : profile ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl border border-[var(--line-soft)] bg-[#f8fafc]">
                {profile.logo_image_url ? (
                  <img src={profile.logo_image_url} alt="ベンダーロゴ" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-xs text-gray-400">未設定</span>
                )}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-800">{profile.business_name}</h2>
                <p className="mt-1 text-sm text-gray-500">担当者 {profile.owner_name || '-'}</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl bg-[#f8fafc] p-4">
                <p className="text-sm font-semibold text-gray-800">主なメニュー</p>
                <p className="mt-2 text-sm text-gray-600 whitespace-pre-wrap">{profile.main_menu || '-'}</p>
              </div>
              <div className="rounded-2xl bg-[#f8fafc] p-4">
                <p className="text-sm font-semibold text-gray-800">SNS・外部情報</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  {profile.instagram_url ? (
                    <a
                      href={profile.instagram_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-[var(--accent-blue)] ring-1 ring-[var(--line-soft)]"
                    >
                      Instagramを見る
                    </a>
                  ) : null}
                  {profile.x_url ? (
                    <a
                      href={profile.x_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-[var(--accent-blue)] ring-1 ring-[var(--line-soft)]"
                    >
                      Xを見る
                    </a>
                  ) : null}
                  {!profile.instagram_url && !profile.x_url ? <p className="text-sm text-gray-500">未設定</p> : null}
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-[#f8fafc] p-5">
              <p className="text-sm font-semibold text-gray-800">紹介文</p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-700">{profile.description || '未設定'}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">ベンダー情報が見つかりませんでした。</p>
        )}
      </div>
    </div>
  )
}
