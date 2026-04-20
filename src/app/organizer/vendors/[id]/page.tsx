'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ApiClientError, fetchApi } from '@/lib/api-client'
import PublicProfileCard from '@/components/PublicProfileCard'
import { getVendorGenreLabel } from '@/lib/vendor-genres'
import type { VendorPublicProfile } from '@/types/marketplace'

export default function OrganizerVendorDetailPage({ params }: { params: { id: string } }) {
  const [profile, setProfile] = useState<VendorPublicProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadProfile() {
    try {
      const data = await fetchApi<VendorPublicProfile | null>(`/api/organizer/vendors/${params.id}`, { cache: 'no-store' })
      setProfile(data)
      setError(null)
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'ベンダー情報の取得に失敗しました')
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
          <PublicProfileCard
            title="ベンダー情報"
            nameLabel="事業者名"
            name={profile.business_name}
            contactLabel="担当者"
            contactName={profile.owner_name}
            genreLabel={getVendorGenreLabel(profile.genre)}
            logoImageUrl={profile.logo_image_url}
            mainMenu={profile.main_menu}
            instagramUrl={profile.instagram_url}
            xUrl={profile.x_url}
            description={profile.description}
          />
        ) : (
          <p className="text-sm text-gray-500">ベンダー情報が見つかりませんでした。</p>
        )}
      </div>
    </div>
  )
}
