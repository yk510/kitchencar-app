import { NextRequest } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import {
  loadVendorOwnedMobileOrderProduct,
  parseUpdateProductInput,
  updateVendorMobileOrderProduct,
} from '@/lib/vendor-mobile-order-products-admin'

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireRouteSession(req)
  if (auth.response) return auth.response

  if (auth.session.role !== 'vendor') {
    return apiError('ベンダー権限が必要です', 403)
  }

  const { id } = await context.params
  const { supabase, user } = auth.session

  try {
    const current = await loadVendorOwnedMobileOrderProduct(supabase, user.id, id)
    const input = parseUpdateProductInput(await req.json(), current)
    return apiOk(await updateVendorMobileOrderProduct(supabase, id, input))
  } catch (error) {
    console.error('[vendor/mobile-order/products/:id PATCH]', error)
    const message = error instanceof Error ? error.message : 'サーバーエラー'
    if (
      message === '商品名は必須です' ||
      message === '価格は0円以上の整数で入力してください' ||
      message === '表示順は0以上の整数で入力してください' ||
      message === '残りわずか閾値は0以上の整数で入力してください'
    ) {
      return apiError(message, 400)
    }
    if (message === '対象の商品が見つかりません') {
      return apiError(message, 404)
    }
    return apiError(message)
  }
}
