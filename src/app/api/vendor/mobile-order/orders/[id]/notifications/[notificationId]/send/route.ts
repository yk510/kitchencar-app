import { NextRequest } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import {
  buildOrderCompletedLineMessages,
  buildOrderReadyLineMessages,
  getLineMessagingConfigStatus,
  sendLinePushMessage,
} from '@/lib/line-messaging'
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

    const { data: store, error: storeError } = await (supabase as any)
      .from('vendor_stores')
      .select('id')
      .eq('id', notification.mobile_orders.store_id)
      .eq('vendor_user_id', user.id)
      .maybeSingle()

    if (storeError) {
      return apiError(storeError.message)
    }
    if (!store) {
      return apiError('対象の通知にアクセスできません', 403)
    }

    const { data: order, error: orderError } = await (supabase as any)
      .from('mobile_orders')
      .select('id, store_id, order_number, pickup_nickname, total_amount, customer_line_user_id, customer_line_display_name')
      .eq('id', id)
      .single()

    if (orderError || !order) {
      return apiError('対象の注文が見つかりません', 404)
    }

    const { data: storeProfile, error: storeProfileError } = await (supabase as any)
      .from('vendor_stores')
      .select('store_name')
      .eq('id', order.store_id)
      .single()

    if (storeProfileError || !storeProfile) {
      return apiError(storeProfileError?.message ?? '店舗情報の取得に失敗しました')
    }

    const now = new Date().toISOString()

    const failNotification = async (message: string) => {
      const { data: failedNotification, error: failedUpdateError } = await (supabase as any)
        .from('mobile_order_notifications')
        .update({
          delivery_status: 'failed',
          failed_at: now,
          error_message: message,
        })
        .eq('id', notificationId)
        .select('*')
        .single()

      if (failedUpdateError || !failedNotification) {
        return apiError(failedUpdateError?.message ?? message)
      }

      await (supabase as any).from('mobile_order_audit_logs').insert([
        {
          order_id: id,
          actor_user_id: user.id,
          action_type: 'notification_send_failed',
          before_status: notification.delivery_status,
          after_status: 'failed',
          payload: {
            notification_id: notificationId,
            notification_type: notification.notification_type,
            reason: message,
          },
        },
      ])

      const payload: MobileOrderNotificationRow = failedNotification
      return apiOk(payload)
    }

    const lineUserId = String(order.customer_line_user_id ?? '').trim()
    if (!lineUserId) {
      return await failNotification('customer_line_user_id が未保存です。LIFFログイン連携後に送信できます。')
    }

    const configStatus = getLineMessagingConfigStatus()
    if (!configStatus.hasChannelAccessToken) {
      return await failNotification('LINE_MESSAGING_API_CHANNEL_ACCESS_TOKEN が未設定です。')
    }

    const storeName = storeProfile.store_name ?? 'ご注文店舗'
    const messages =
      notification.notification_type === 'order_completed'
        ? buildOrderCompletedLineMessages({
            storeName,
            orderNumber: order.order_number,
            pickupNickname: order.pickup_nickname,
            totalAmount: order.total_amount,
          })
        : buildOrderReadyLineMessages({
            storeName,
            orderNumber: order.order_number,
            pickupNickname: order.pickup_nickname,
          })

    let pushResult: { requestId: string | null }
    try {
      pushResult = await sendLinePushMessage({
        to: lineUserId,
        messages,
      })
    } catch (error) {
      return await failNotification(error instanceof Error ? error.message : 'LINE送信に失敗しました')
    }

    const { data: updatedNotification, error: updateError } = await (supabase as any)
      .from('mobile_order_notifications')
      .update({
        delivery_status: 'sent',
        line_message_id: pushResult.requestId,
        sent_at: now,
        failed_at: null,
        error_message: null,
      })
      .eq('id', notificationId)
      .select('*')
      .single()

    if (updateError || !updatedNotification) {
      return apiError(updateError?.message ?? '通知送信の更新に失敗しました')
    }

    await (supabase as any).from('mobile_order_audit_logs').insert([
      {
        order_id: id,
        actor_user_id: user.id,
        action_type: 'notification_sent',
        before_status: notification.delivery_status,
        after_status: 'sent',
        payload: {
          notification_id: notificationId,
          notification_type: notification.notification_type,
          line_message_id: pushResult.requestId,
          delivery_channel: 'line_push',
        },
      },
    ])

    const payload: MobileOrderNotificationRow = updatedNotification
    return apiOk(payload)
  } catch (error) {
    console.error('[vendor/mobile-order/orders/:id/notifications/:notificationId/send POST]', error)
    return apiError('サーバーエラー')
  }
}
