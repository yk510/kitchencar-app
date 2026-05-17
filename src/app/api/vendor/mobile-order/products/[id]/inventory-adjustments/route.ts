import { NextRequest } from 'next/server'
import {
  executeVendorMobileOrderJsonRoute,
} from '@/lib/vendor-mobile-order-route'
import {
  createInventoryAdjustmentForVendorProduct,
  parseInventoryAdjustmentInput,
} from '@/lib/vendor-mobile-order-product-inventory'

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  return executeVendorMobileOrderJsonRoute<Record<string, unknown>, unknown>(
    req,
    '[vendor/mobile-order/products/:id/inventory-adjustments POST]',
    async ({ supabase, user }, body) => {
      const input = parseInventoryAdjustmentInput(body)
      return createInventoryAdjustmentForVendorProduct(supabase, user, id, input)
    },
    {
      badRequest: ['営業枠が指定されていません', '在庫調整数は0以外の整数で入力してください'],
      notFound: ['対象の商品が見つかりません'],
      conflict: ['この商品は在庫管理が無効です', '先に初期在庫を設定してください'],
    }
  )
}
