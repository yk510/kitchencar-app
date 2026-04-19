import { NextRequest } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import type { VendorWeeklyReportFeedbackPayload } from '@/types/api-payloads'

export const dynamic = 'force-dynamic'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireRouteSession(req)
    if (auth.response) return auth.response
    const { session } = auth

    if (session.role !== 'vendor') {
      return apiError('ベンダーのみ利用できます', 403)
    }

    const body = await req.json()
    const helpful_feedback =
      typeof body.helpful_feedback === 'boolean' ? body.helpful_feedback : null

    if (helpful_feedback == null) {
      return apiError('評価内容が不正です', 400)
    }

    const { data, error } = await (session.supabase as any)
      .from('vendor_weekly_reports')
      .update({
        helpful_feedback,
        helpful_marked_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .select('*')
      .single()

    if (error) {
      return apiError(error.message)
    }

    const payload: VendorWeeklyReportFeedbackPayload = data
    return apiOk(payload)
  } catch (error) {
    console.error('[vendor/weekly-reports/[id] PATCH]', error)
    return apiError('週報評価の保存に失敗しました')
  }
}
