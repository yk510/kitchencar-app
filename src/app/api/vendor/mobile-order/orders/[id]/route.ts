import { NextRequest } from 'next/server'
import type {
  VendorMobileOrderOrderMutationPayload,
} from '@/types/api-payloads'
import { getVendorOrderDetailPayload } from '@/lib/vendor-mobile-order-dashboard-api'
import {
  changeVendorOrderStatus,
  receiveVendorOrderPayment,
  validateOrderMutationInput,
} from '@/lib/vendor-mobile-order-dashboard-mutations'
import {
  executeVendorMobileOrderJsonRoute,
  executeVendorMobileOrderRoute,
} from '@/lib/vendor-mobile-order-route'

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  return executeVendorMobileOrderRoute(req, '[vendor/mobile-order/orders/:id GET]', async ({ supabase, user }) =>
    getVendorOrderDetailPayload(supabase, user, id)
  )
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  return executeVendorMobileOrderJsonRoute<Record<string, unknown>, VendorMobileOrderOrderMutationPayload>(
    req,
    '[vendor/mobile-order/orders/:id PATCH]',
    async ({ supabase, user }, body) => {
      const { action, nextStatus } = validateOrderMutationInput(body)

      if (action === 'receive_payment') {
        return receiveVendorOrderPayment(supabase, user, id)
      }

      return changeVendorOrderStatus(supabase, user, id, nextStatus)
    },
    {
      badRequest: ['不正な注文ステータスです'],
      notFound: ['対象の注文が見つかりません'],
      conflict: [
        'POS注文以外では料金受領できません',
        'この注文はすでに受領済みです',
        'この注文ステータスには変更できません',
      ],
    }
  )
}
