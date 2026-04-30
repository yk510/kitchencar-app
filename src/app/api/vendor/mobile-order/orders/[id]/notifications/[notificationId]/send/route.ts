import { NextRequest } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import { sendMobileOrderLineNotification } from '@/lib/mobile-order-notifications'
import type { MobileOrderNotificationRow } from '@/types/api-payloads'

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string; notificationId: string }> }
) {
  const auth = await requireRouteSession(req)
  if (auth.response) return auth.response

  if (auth.session.role !== 'vendor') {
    return apiError('ベンダー権限が必要です', 403)
  }

  const { id, notificationId } = await context.params
  const { supabase, user } = auth.session

  try {
    const { data: notification, error: notificationError } = await (supabase as any)
      .from('mobile_order_notifications')
      .select('*')
      .eq('id', notificationId)
      .eq('order_id', id)
      .single()

    if (notificationError || !notification) {
      return apiError('対象の通知が見つかりません', 404)
    }

    const { data: order, error: orderError } = await (supabase as any)
      .from('mobile_orders')
      .select('id, store_id')
      .eq('id', id)
      .single()

    if (orderError || !order) {
      return apiError('対象の注文が見つかりません', 404)
    }

    const { data: store, error: storeError } = await (supabase as any)
      .from('vendor_stores')
      .select('id')
      .eq('id', order.store_id)
      .eq('vendor_user_id', user.id)
      .maybeSingle()

    if (storeError) {
      return apiError(storeError.message)
    }
    if (!store) {
      return apiError('対象の通知にアクセスできません', 403)
    }

    const updatedNotification = await sendMobileOrderLineNotification({
      supabase,
      orderId: id,
      notificationId,
      actorUserId: user.id,
    })

    const payload: MobileOrderNotificationRow = updatedNotification
    return apiOk(payload)
  } catch (error) {
    console.error('[vendor/mobile-order/orders/:id/notifications/:notificationId/send POST]', error)
    return apiError('サーバーエラー')
  }
}
