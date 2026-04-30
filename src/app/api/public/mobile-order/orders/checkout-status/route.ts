import { NextRequest } from 'next/server'
import { apiError, apiOk } from '@/lib/api-response'
import { createServerSupabaseClient } from '@/lib/supabase'
import type { PublicMobileOrderCheckoutStatusResponse } from '@/types/api-payloads'

export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient()

  const publicToken = req.nextUrl.searchParams.get('public_token')?.trim() || ''
  const orderId = req.nextUrl.searchParams.get('order_id')?.trim() || ''
  const checkoutSessionId = req.nextUrl.searchParams.get('checkout_session_id')?.trim() || ''

  if (!publicToken || !orderId || !checkoutSessionId) {
    return apiError('決済確認に必要な情報が不足しています', 400)
  }

  const { data: orderPage, error: orderPageError } = await (supabase as any)
    .from('store_order_pages')
    .select('id, public_token')
    .eq('public_token', publicToken)
    .eq('status', 'published')
    .maybeSingle()

  if (orderPageError) return apiError(orderPageError.message)
  if (!orderPage) return apiError('注文ページが見つかりません', 404)

  const { data: order, error: orderError } = await (supabase as any)
    .from('mobile_orders')
    .select('id, order_page_id, order_number, pickup_nickname, total_amount, ordered_at, payment_status, payment_reference')
    .eq('id', orderId)
    .single()

  if (orderError || !order) {
    return apiError(orderError?.message ?? '注文情報が見つかりません', 404)
  }

  if (order.order_page_id !== orderPage.id) {
    return apiError('この注文情報にはアクセスできません', 403)
  }

  if (order.payment_reference !== checkoutSessionId) {
    return apiError('決済確認情報が一致しません', 409)
  }

  const payload: PublicMobileOrderCheckoutStatusResponse = {
    order_id: order.id,
    order_number: order.order_number,
    pickup_nickname: order.pickup_nickname,
    total_amount: order.total_amount,
    ordered_at: order.ordered_at,
    payment_status: order.payment_status,
  }

  return apiOk(payload)
}
