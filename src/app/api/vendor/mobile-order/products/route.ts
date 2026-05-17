import { NextRequest } from 'next/server'
import { apiError, apiOk } from '@/lib/api-response'
import {
  requireVendorMobileOrderRouteContext,
  toVendorMobileOrderRouteError,
} from '@/lib/vendor-mobile-order-route'
import {
  createVendorMobileOrderProduct,
  getVendorManagedProductsPayload,
  parseCreateProductInput,
} from '@/lib/vendor-mobile-order-products-admin'

export async function GET(req: NextRequest) {
  const resolved = await requireVendorMobileOrderRouteContext(req)
  if (resolved.response) return resolved.response
  const { supabase, user } = resolved.context

  try {
    return apiOk(await getVendorManagedProductsPayload(supabase, user))
  } catch (error) {
    return toVendorMobileOrderRouteError('[vendor/mobile-order/products GET]', error)
  }
}

export async function POST(req: NextRequest) {
  const resolved = await requireVendorMobileOrderRouteContext(req)
  if (resolved.response) return resolved.response
  const { supabase, user } = resolved.context

  try {
    const input = parseCreateProductInput(await req.json())
    return apiOk(await createVendorMobileOrderProduct(supabase, user, input))
  } catch (error) {
    return toVendorMobileOrderRouteError('[vendor/mobile-order/products POST]', error, {
      badRequest: ['商品名は必須です', '価格は0円以上の整数で入力してください', '残りわずか閾値は0以上の整数で入力してください'],
    })
  }
}
