import { NextRequest } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import {
  createInitialInventoryForVendorProduct,
  parseInitialInventoryInput,
} from '@/lib/vendor-mobile-order-product-inventory'

export async function POST(
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
    const input = parseInitialInventoryInput(await req.json())
    return apiOk(await createInitialInventoryForVendorProduct(supabase, user, id, input))
  } catch (error) {
    console.error('[vendor/mobile-order/products/:id/inventory POST]', error)
    const message = error instanceof Error ? error.message : 'サーバーエラー'
    if (message === '営業枠が指定されていません' || message === '初期在庫数は0以上の整数で入力してください') {
      return apiError(message, 400)
    }
    if (message === '対象の商品が見つかりません' || message === '対象の営業枠が見つかりません') {
      return apiError(message, 404)
    }
    if (message === 'この商品は在庫管理が無効です' || message === '初期在庫はすでに設定済みです。変更は在庫調整で行ってください') {
      return apiError(message, 409)
    }
    return apiError(message)
  }
}
