import { NextRequest } from 'next/server'
import { apiError, apiOk } from '@/lib/api-response'
import { createPreparedMobileOrder, preparePublicOrderDraft } from '@/lib/mobile-order-ordering'
import { createServerSupabaseClient } from '@/lib/supabase'
import type { StorePosCreatePayload } from '@/types/api-payloads'

type StorePosOrderCreateResponse = {
  order_id: string
  order_number: string
  payment_status: 'pending' | 'paid'
  payment_method: 'cash' | 'paypay' | 'other'
  total_amount: number
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient()

  try {
    const body = (await req.json()) as StorePosCreatePayload
    const paymentMethod = body.payment_method

    if (!paymentMethod || !['cash', 'paypay', 'other'].includes(paymentMethod)) {
      return apiError('支払方法を選択してください', 400)
    }

    const draft = await preparePublicOrderDraft(supabase, body)

    if (draft.store.is_store_pos_enabled === false) {
      return apiError('この店舗では店頭POS注文が無効です', 409)
    }

    const enabledPaymentMethods = Array.isArray(draft.store.store_pos_enabled_payment_methods)
      ? draft.store.store_pos_enabled_payment_methods
      : ['cash', 'paypay', 'other']
    if (!enabledPaymentMethods.includes(paymentMethod)) {
      return apiError('選択した支払方法は利用できません', 409)
    }

    const paymentProvider =
      paymentMethod === 'cash'
        ? 'store_pos_cash'
        : paymentMethod === 'paypay'
          ? 'store_pos_paypay'
          : 'store_pos_other'

    const order = await createPreparedMobileOrder(supabase, draft, {
      payment_status: 'pending',
      payment_provider: paymentProvider,
    })

    const payload: StorePosOrderCreateResponse = {
      order_id: order.id,
      order_number: order.order_number,
      payment_status: 'pending',
      payment_method: paymentMethod,
      total_amount: order.total_amount,
    }

    return apiOk(payload)
  } catch (error) {
    console.error('[public/store-pos/orders POST]', error)
    return apiError(error instanceof Error ? error.message : 'サーバーエラー')
  }
}
