import { NextRequest } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import {
  createVendorMobileOrderProduct,
  getVendorManagedProductsPayload,
  parseCreateProductInput,
} from '@/lib/vendor-mobile-order-products-admin'

export async function GET(req: NextRequest) {
  const auth = await requireRouteSession(req)
  if (auth.response) return auth.response

  if (auth.session.role !== 'vendor') {
    return apiError('ベンダー権限が必要です', 403)
  }

  const { supabase, user } = auth.session

  try {
    return apiOk(await getVendorManagedProductsPayload(supabase, user))
  } catch (error) {
    console.error('[vendor/mobile-order/products GET]', error)
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
    const input = parseCreateProductInput(await req.json())
    return apiOk(await createVendorMobileOrderProduct(supabase, user, input))
  } catch (error) {
    console.error('[vendor/mobile-order/products POST]', error)
    const message = error instanceof Error ? error.message : 'サーバーエラー'
    if (
      message === '商品名は必須です' ||
      message === '価格は0円以上の整数で入力してください' ||
      message === '残りわずか閾値は0以上の整数で入力してください'
    ) {
      return apiError(message, 400)
    }
    return apiError(message)
  }
}
