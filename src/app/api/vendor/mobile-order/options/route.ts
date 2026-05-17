import { NextRequest } from 'next/server'
import {
  executeVendorMobileOrderJsonRoute,
  executeVendorMobileOrderRoute,
} from '@/lib/vendor-mobile-order-route'
import {
  createVendorOptionGroup,
  getVendorMobileOrderOptionsPayload,
  parseOptionGroupInput,
} from '@/lib/vendor-mobile-order-options-admin'

export async function GET(req: NextRequest) {
  return executeVendorMobileOrderRoute(req, '[vendor/mobile-order/options GET]', async ({ supabase, user }) =>
    getVendorMobileOrderOptionsPayload(supabase, user)
  )
}

export async function POST(req: NextRequest) {
  return executeVendorMobileOrderJsonRoute<Record<string, unknown>, unknown>(
    req,
    '[vendor/mobile-order/options POST]',
    async ({ supabase, user }, body) => {
      const input = parseOptionGroupInput(body, 'create')
      return createVendorOptionGroup(supabase, user, input)
    },
    {
      badRequest: [
        'オプショングループ名は必須です',
        '選択方式が不正です',
        '選択肢を1件以上入力してください',
        '選択肢名は必須です',
      ],
    }
  )
}
