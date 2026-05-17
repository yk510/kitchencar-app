import { NextRequest } from 'next/server'
import {
  executeVendorMobileOrderJsonRoute,
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
  const { id } = await context.params
  return executeVendorMobileOrderJsonRoute<Record<string, unknown>, unknown>(
    req,
    '[vendor/mobile-order/products/:id PATCH]',
    async ({ supabase, user }, body) => {
      const current = await loadVendorOwnedMobileOrderProduct(supabase, user.id, id)
      const input = parseUpdateProductInput(body, current)
      return updateVendorMobileOrderProduct(supabase, id, input)
    },
    {
      badRequest: [
        '商品名は必須です',
        '価格は0円以上の整数で入力してください',
        '表示順は0以上の整数で入力してください',
        '残りわずか閾値は0以上の整数で入力してください',
      ],
      notFound: ['対象の商品が見つかりません'],
    }
  )
}
