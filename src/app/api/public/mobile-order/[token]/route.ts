import { NextRequest } from 'next/server'
import { unstable_noStore as noStore } from 'next/cache'
import { apiError, apiOk } from '@/lib/api-response'
import { loadPublicMobileOrderHydratedPayload } from '@/lib/public-mobile-order-data'
import { createServerSupabaseClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  noStore()
  const { token } = await context.params
  const supabase = createServerSupabaseClient()
  try {
    const payload = await loadPublicMobileOrderHydratedPayload(supabase, token, { applyStorePosSettings: true })

    if (!payload) {
      return apiError('注文ページが見つかりません', 404)
    }

    return apiOk(payload)
  } catch (error) {
    return apiError(error instanceof Error ? error.message : '注文ページの取得に失敗しました')
  }
}
