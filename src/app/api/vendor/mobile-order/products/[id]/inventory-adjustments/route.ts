import { NextRequest } from 'next/server'
import { apiOk } from '@/lib/api-response'
import {
  requireVendorMobileOrderRouteContext,
  toVendorMobileOrderRouteError,
} from '@/lib/vendor-mobile-order-route'
import {
  createInventoryAdjustmentForVendorProduct,
  parseInventoryAdjustmentInput,
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
    const input = parseInventoryAdjustmentInput(await req.json())
    return apiOk(await createInventoryAdjustmentForVendorProduct(supabase, user, id, input))
  } catch (error) {
    return toVendorMobileOrderRouteError('[vendor/mobile-order/products/:id/inventory-adjustments POST]', error, {
      badRequest: ['営業枠が指定されていません', '在庫調整数は0以外の整数で入力してください'],
      notFound: ['対象の商品が見つかりません'],
      conflict: ['この商品は在庫管理が無効です', '先に初期在庫を設定してください'],
    })
  }
}
