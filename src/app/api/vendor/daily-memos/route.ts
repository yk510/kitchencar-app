import { NextRequest } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import { getVendorDailyMemos } from '@/lib/vendor-reflection'
import type {
  VendorDailyMemoListPayload,
  VendorDailyMemoMutationPayload,
} from '@/types/api-payloads'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRouteSession(req)
    if (auth.response) return auth.response
    const { session } = auth

    if (session.role !== 'vendor') {
      return apiError('ベンダーのみ利用できます', 403)
    }

    const { searchParams } = new URL(req.url)
    const start = searchParams.get('start')
    const end = searchParams.get('end')

    if (!start || !end) {
      return apiError('期間が不正です', 400)
    }

    const payload: VendorDailyMemoListPayload = await getVendorDailyMemos(session.supabase, start, end)
    return apiOk(payload)
  } catch (error) {
    console.error('[vendor/daily-memos GET]', error)
    return apiError('営業メモの取得に失敗しました')
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireRouteSession(req)
    if (auth.response) return auth.response
    const { session } = auth

    if (session.role !== 'vendor') {
      return apiError('ベンダーのみ利用できます', 403)
    }

    const body = await req.json()
    const memo_date = String(body.memo_date ?? '').trim()
    const memo_text = String(body.memo_text ?? '').trim()

    if (!memo_date) {
      return apiError('対象日が必要です', 400)
    }

    const { data, error } = await (session.supabase as any)
      .from('vendor_daily_memos')
      .upsert(
        [
          {
            user_id: session.user.id,
            memo_date,
            memo_text,
          },
        ],
        { onConflict: 'user_id,memo_date' }
      )
      .select('id, memo_date, memo_text, created_at, updated_at')
      .single()

    if (error) {
      return apiError(error.message)
    }

    const payload: VendorDailyMemoMutationPayload = data
    return apiOk(payload)
  } catch (error) {
    console.error('[vendor/daily-memos PUT]', error)
    return apiError('営業メモの保存に失敗しました')
  }
}
