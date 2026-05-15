import { NextRequest } from 'next/server'
import { apiError, apiOk } from '@/lib/api-response'
import { isStorePosOrder } from '@/lib/mobile-order-fields'
import { createServerSupabaseClient } from '@/lib/supabase'
import type { PublicStorePosOrderStatusResponse } from '@/types/api-payloads'

function isMissingPaidAtColumnError(error: unknown) {
  const message = String((error as { message?: string } | null)?.message ?? '')
  return message.includes('paid_at') || message.includes('order_source') || message.includes('payment_method')
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const supabase = createServerSupabaseClient()
  const { id } = await context.params
  const publicToken = req.nextUrl.searchParams.get('public_token')?.trim() || ''

  if (!publicToken) {
    return apiError('注文ページ情報が不足しています', 400)
  }

  const { data: orderPage, error: orderPageError } = await (supabase as any)
    .from('store_order_pages')
    .select('id, public_token')
    .eq('public_token', publicToken)
    .eq('status', 'published')
    .maybeSingle()

  if (orderPageError) return apiError(orderPageError.message)
  if (!orderPage) return apiError('注文ページが見つかりません', 404)

  let orderResult = await (supabase as any)
    .from('mobile_orders')
    .select('id, order_page_id, order_number, total_amount, payment_status, status, paid_at, cancelled_at, payment_provider, order_source, payment_method')
    .eq('id', id)
    .single()

  if (orderResult.error && isMissingPaidAtColumnError(orderResult.error)) {
    orderResult = await (supabase as any)
      .from('mobile_orders')
      .select('id, order_page_id, order_number, total_amount, payment_status, status, cancelled_at, payment_provider')
      .eq('id', id)
      .single()
  }

  const { data: order, error: orderError } = orderResult

  if (orderError || !order) {
    return apiError(orderError?.message ?? '注文情報が見つかりません', 404)
  }

  if (order.order_page_id !== orderPage.id) {
    return apiError('この注文情報にはアクセスできません', 403)
  }

  if (!isStorePosOrder(order)) {
    return apiError('POS注文ではありません', 409)
  }

  const payload: PublicStorePosOrderStatusResponse = {
    order_id: order.id,
    order_number: order.order_number,
    total_amount: order.total_amount,
    payment_status: order.payment_status,
    status: order.status,
    paid_at: 'paid_at' in order ? order.paid_at ?? null : null,
    cancelled_at: order.cancelled_at ?? null,
  }

  return apiOk(payload)
}
