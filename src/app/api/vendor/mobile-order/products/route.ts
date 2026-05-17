import { NextRequest } from 'next/server'
import {
  executeVendorMobileOrderJsonRoute,
  executeVendorMobileOrderRoute,
} from '@/lib/vendor-mobile-order-route'
import {
  createVendorMobileOrderProduct,
  getVendorManagedProductsPayload,
  parseCreateProductInput,
} from '@/lib/vendor-mobile-order-products-admin'

export async function GET(req: NextRequest) {
  return executeVendorMobileOrderRoute(req, '[vendor/mobile-order/products GET]', async ({ supabase, user }) =>
    getVendorManagedProductsPayload(supabase, user)
  )
}

export async function POST(req: NextRequest) {
  return executeVendorMobileOrderJsonRoute<Record<string, unknown>, unknown>(
    req,
    '[vendor/mobile-order/products POST]',
    async ({ supabase, user }, body) => {
      const input = parseCreateProductInput(body)
      return createVendorMobileOrderProduct(supabase, user, input)
    },
    {
      badRequest: ['商品名は必須です', '価格は0円以上の整数で入力してください', '残りわずか閾値は0以上の整数で入力してください'],
    }
  )
}
