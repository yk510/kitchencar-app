import { NextRequest } from 'next/server'
import { apiOk } from '@/lib/api-response'
import {
  requireVendorMobileOrderRouteContext,
  toVendorMobileOrderRouteError,
} from '@/lib/vendor-mobile-order-route'
import {
  loadVendorOwnedMobileOrderProduct,
  parseUpdateProductInput,
  updateVendorMobileOrderProduct,
} from '@/lib/vendor-mobile-order-products-admin'

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const resolved = await requireVendorMobileOrderRouteContext(req)
  if (resolved.response) return resolved.response
  const { id } = await context.params
  const { supabase, user } = resolved.context

  try {
    const current = await loadVendorOwnedMobileOrderProduct(supabase, user.id, id)
    const input = parseUpdateProductInput(await req.json(), current)
    return apiOk(await updateVendorMobileOrderProduct(supabase, id, input))
  } catch (error) {
    return toVendorMobileOrderRouteError('[vendor/mobile-order/products/:id PATCH]', error, {
      badRequest: [
        '商品名は必須です',
        '価格は0円以上の整数で入力してください',
        '表示順は0以上の整数で入力してください',
        '残りわずか閾値は0以上の整数で入力してください',
      ],
      notFound: ['対象の商品が見つかりません'],
    })
  }
}
