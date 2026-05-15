import { notFound } from 'next/navigation'
import { unstable_noStore as noStore } from 'next/cache'
import PublicMobileOrderPageClient from '@/components/PublicMobileOrderPageClient'
import { loadPublicMobileOrderBasePayload } from '@/lib/public-mobile-order-data'
import { createServerSupabaseClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export default async function OrderPage({ params }: { params: Promise<{ token: string }> }) {
  noStore()
  const { token } = await params
  const supabase = createServerSupabaseClient()

  const payload = await loadPublicMobileOrderBasePayload(supabase, token)

  if (!payload) {
    notFound()
  }

  return <PublicMobileOrderPageClient data={payload} />
}
