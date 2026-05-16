import { NextRequest } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import {
  createVendorOptionGroup,
  getVendorMobileOrderOptionsPayload,
  parseOptionGroupInput,
} from '@/lib/vendor-mobile-order-options-admin'

export async function GET(req: NextRequest) {
  const auth = await requireRouteSession(req)
  if (auth.response) return auth.response

  if (auth.session.role !== 'vendor') {
    return apiError('ベンダー権限が必要です', 403)
  }

  const { supabase, user } = auth.session

  try {
    return apiOk(await getVendorMobileOrderOptionsPayload(supabase, user))
  } catch (error) {
    console.error('[vendor/mobile-order/options GET]', error)
    return apiError(error instanceof Error ? error.message : 'サーバーエラー')
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRouteSession(req)
  if (auth.response) return auth.response

  if (auth.session.role !== 'vendor') {
    return apiError('ベンダー権限が必要です', 403)
  }

  const { supabase, user } = auth.session

  try {
    const input = parseOptionGroupInput(await req.json(), 'create')
    return apiOk(await createVendorOptionGroup(supabase, user, input))
  } catch (error) {
    console.error('[vendor/mobile-order/options POST]', error)
    const message = error instanceof Error ? error.message : 'サーバーエラー'
    if (
      message === 'オプショングループ名は必須です' ||
      message === '選択方式が不正です' ||
      message === '選択肢を1件以上入力してください' ||
      message === '選択肢名は必須です'
    ) {
      return apiError(message, 400)
    }
    return apiError(message)
  }
}
