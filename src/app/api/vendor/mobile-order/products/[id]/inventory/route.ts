import { NextRequest } from 'next/server'
import { apiOk } from '@/lib/api-response'
import {
  requireVendorMobileOrderRouteContext,
  toVendorMobileOrderRouteError,
} from '@/lib/vendor-mobile-order-route'
import {
  createInitialInventoryForVendorProduct,
  parseInitialInventoryInput,
} from '@/lib/vendor-mobile-order-product-inventory'

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const resolved = await requireVendorMobileOrderRouteContext(req)
  if (resolved.response) return resolved.response
  const { id } = await context.params
  const { supabase, user } = resolved.context

  try {
    const input = parseInitialInventoryInput(await req.json())
    return apiOk(await createInitialInventoryForVendorProduct(supabase, user, id, input))
  } catch (error) {
    return toVendorMobileOrderRouteError('[vendor/mobile-order/products/:id/inventory POST]', error, {
      badRequest: ['営業枠が指定されていません', '初期在庫数は0以上の整数で入力してください'],
      notFound: ['対象の商品が見つかりません', '対象の営業枠が見つかりません'],
      conflict: ['この商品は在庫管理が無効です', '初期在庫はすでに設定済みです。変更は在庫調整で行ってください'],
    })
  }
}
