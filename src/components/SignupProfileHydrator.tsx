'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/AuthProvider'
import { ApiClientError, fetchApi } from '@/lib/api-client'
import { notifyProfileUpdated } from '@/lib/profile-sync'
import type { AppRole } from '@/lib/user-role'

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

function hasOptionalVendorFields(profile: VendorDraft) {
  return !!(
    String(profile.main_menu ?? '').trim() ||
    String(profile.logo_image_url ?? '').trim() ||
    String(profile.instagram_url ?? '').trim() ||
    String(profile.x_url ?? '').trim() ||
    String(profile.description ?? '').trim()
  )
}

function hasOptionalOrganizerFields(profile: OrganizerDraft) {
  return !!(
    String(profile.logo_image_url ?? '').trim() ||
    String(profile.instagram_url ?? '').trim() ||
    String(profile.x_url ?? '').trim() ||
    String(profile.description ?? '').trim()
  )
}

export default function SignupProfileHydrator({ role }: { role: AppRole }) {
  const { user, refreshProfile } = useAuth()
  const [status, setStatus] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle')
  const storageKey = `draft:signup-${role}-form`

  useEffect(() => {
    if (!user) return

    const userEmail = user.email ?? ''

    const storedDraft =
      typeof window !== 'undefined' ? window.localStorage.getItem(storageKey) : null

    const fallbackProfile =
      (user.user_metadata?.onboarding_profile as VendorDraft | OrganizerDraft | undefined) ?? null

    const draftProfile = storedDraft ? (JSON.parse(storedDraft) as VendorDraft | OrganizerDraft) : null
    const sourceProfile = draftProfile ?? fallbackProfile

    if (!sourceProfile) {
      return
    }

    const hasOptionalFields =
      role === 'vendor'
        ? hasOptionalVendorFields(sourceProfile as VendorDraft)
        : hasOptionalOrganizerFields(sourceProfile as OrganizerDraft)

    if (!hasOptionalFields) {
      if (storedDraft && typeof window !== 'undefined') {
        window.localStorage.removeItem(storageKey)
      }
      return
    }

    let cancelled = false

    async function syncOptionalProfileFields() {
      setStatus('syncing')

      try {
        if (role === 'vendor') {
          const vendorProfile = sourceProfile as VendorDraft
          await fetchApi('/api/vendor/profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              business_name: vendorProfile.business_name ?? '',
              owner_name: vendorProfile.owner_name ?? '',
              contact_email: vendorProfile.contact_email ?? userEmail,
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
              contact_email: organizerProfile.contact_email ?? userEmail,
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
        setStatus('done')
      } catch (error) {
        if (cancelled) return
        console.error('[SignupProfileHydrator]', error)
        setStatus('error')
      }
    }

    void syncOptionalProfileFields()

    return () => {
      cancelled = true
    }
  }, [refreshProfile, role, storageKey, user])

  if (status === 'idle' || status === 'done') {
    return null
  }

  return (
    <div className="soft-panel rounded-[24px] border border-[var(--line-soft)] bg-white/90 px-5 py-4">
      <p className="text-sm font-semibold text-[var(--text-main)]">
        {status === 'syncing'
          ? 'プロフィールの詳細を反映しています'
          : 'プロフィールの詳細反映はあとで設定画面から続けられます'}
      </p>
      <p className="mt-1 text-sm leading-7 text-[var(--text-sub)]">
        {status === 'syncing'
          ? '先に次の画面へ進める状態にはなっています。紹介文やSNSなどの任意項目を裏で更新しています。'
          : '登録は完了しています。任意項目は、事業者設定 / 主催者設定からいつでも見直せます。'}
      </p>
    </div>
  )
}
