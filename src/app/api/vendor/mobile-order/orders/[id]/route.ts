import { NextRequest } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import type {
  VendorMobileOrderOrderMutationPayload,
} from '@/types/api-payloads'
import { getVendorOrderDetailPayload } from '@/lib/vendor-mobile-order-dashboard-api'
import {
  changeVendorOrderStatus,
  receiveVendorOrderPayment,
  validateOrderMutationInput,
} from '@/lib/vendor-mobile-order-dashboard-mutations'

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireRouteSession(req)
  if (auth.response) return auth.response

  if (auth.session.role !== 'vendor') {
    return apiError('ベンダー権限が必要です', 403)
  }

  const { id } = await context.params
  const { supabase, user } = auth.session

  try {
    return apiOk(await getVendorOrderDetailPayload(supabase, user, id))
  } catch (error) {
    console.error('[vendor/mobile-order/orders/:id GET]', error)
    return apiError(error instanceof Error ? error.message : 'サーバーエラー')
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireRouteSession(req)
  if (auth.response) return auth.response

  if (auth.session.role !== 'vendor') {
    return apiError('ベンダー権限が必要です', 403)
  }

  const { id } = await context.params
  const { supabase, user } = auth.session

  try {
    const body = await req.json()
    const { action, nextStatus } = validateOrderMutationInput(body)

    if (action === 'receive_payment') {
      const payload: VendorMobileOrderOrderMutationPayload = await receiveVendorOrderPayment(
        supabase,
        user,
        id
      )
      return apiOk(payload)
    }

    const payload: VendorMobileOrderOrderMutationPayload = await changeVendorOrderStatus(
      supabase,
      user,
      id,
      nextStatus
    )
    return apiOk(payload)
  } catch (error) {
    console.error('[vendor/mobile-order/orders/:id PATCH]', error)
    const message = error instanceof Error ? error.message : 'サーバーエラー'
    const status =
      message === '不正な注文ステータスです'
        ? 400
        : message === '対象の注文が見つかりません'
          ? 404
          : message.includes('できません') || message.includes('失敗しました') || message.includes('受領済み')
            ? 409
            : 500
    return apiError(message, status)
  }
}
