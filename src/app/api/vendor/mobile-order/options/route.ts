import { NextRequest } from 'next/server'
import { apiOk } from '@/lib/api-response'
import {
  requireVendorMobileOrderRouteContext,
  toVendorMobileOrderRouteError,
} from '@/lib/vendor-mobile-order-route'
import {
  createVendorOptionGroup,
  getVendorMobileOrderOptionsPayload,
  parseOptionGroupInput,
} from '@/lib/vendor-mobile-order-options-admin'

export async function GET(req: NextRequest) {
  const resolved = await requireVendorMobileOrderRouteContext(req)
  if (resolved.response) return resolved.response
  const { supabase, user } = resolved.context

  try {
    return apiOk(await getVendorMobileOrderOptionsPayload(supabase, user))
  } catch (error) {
    return toVendorMobileOrderRouteError('[vendor/mobile-order/options GET]', error)
  }
}

export async function POST(req: NextRequest) {
  const resolved = await requireVendorMobileOrderRouteContext(req)
  if (resolved.response) return resolved.response
  const { supabase, user } = resolved.context

  try {
    const input = parseOptionGroupInput(await req.json(), 'create')
    return apiOk(await createVendorOptionGroup(supabase, user, input))
  } catch (error) {
    return toVendorMobileOrderRouteError('[vendor/mobile-order/options POST]', error, {
      badRequest: [
        'オプショングループ名は必須です',
        '選択方式が不正です',
        '選択肢を1件以上入力してください',
        '選択肢名は必須です',
      ],
    })
  }
}
