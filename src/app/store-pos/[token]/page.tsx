import { notFound } from 'next/navigation'
import { unstable_noStore as noStore } from 'next/cache'
import StorePosPageClient from '@/components/StorePosPageClient'
import { loadPublicMobileOrderBasePayload } from '@/lib/public-mobile-order-data'
import { createServerSupabaseClient } from '@/lib/supabase'

type StorePosPageProps = {
  params: {
    token: string
  }
}

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export default async function StorePosPage({ params }: StorePosPageProps) {
  noStore()
  const supabase = createServerSupabaseClient()
  const token = String(params.token ?? '').trim()

  if (!token) {
    notFound()
  }

  const payload = await loadPublicMobileOrderBasePayload(supabase, token, { applyStorePosSettings: true })

  if (!payload) {
    notFound()
  }

  return <StorePosPageClient data={payload} />
}
