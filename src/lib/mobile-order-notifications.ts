import {
  buildOrderCompletedLineMessages,
  buildOrderPreparingLineMessages,
  buildOrderReadyLineMessages,
  getLineMessagingConfigStatus,
  sendLinePushMessage,
} from '@/lib/line-messaging'
import type { MobileOrderNotificationRow } from '@/types/api-payloads'

type SendMobileOrderLineNotificationInput = {
  supabase: any
  orderId: string
  notificationId: string
  actorUserId?: string | null
}

export async function sendMobileOrderLineNotification(input: SendMobileOrderLineNotificationInput) {
  const { supabase, orderId, notificationId, actorUserId = null } = input

  const { data: notification, error: notificationError } = await (supabase as any)
    .from('mobile_order_notifications')
    .select('*')
    .eq('id', notificationId)
    .eq('order_id', orderId)
    .single()

  if (notificationError || !notification) {
    throw new Error(notificationError?.message ?? '対象の通知が見つかりません')
  }

  const { data: order, error: orderError } = await (supabase as any)
    .from('mobile_orders')
    .select('id, store_id, order_number, pickup_nickname, total_amount, customer_line_user_id, customer_line_display_name')
    .eq('id', orderId)
    .single()

  if (orderError || !order) {
    throw new Error(orderError?.message ?? '対象の注文が見つかりません')
  }

  const { data: storeProfile, error: storeProfileError } = await (supabase as any)
    .from('vendor_stores')
    .select('store_name')
    .eq('id', order.store_id)
    .single()

  if (storeProfileError || !storeProfile) {
    throw new Error(storeProfileError?.message ?? '店舗情報の取得に失敗しました')
  }

  const { data: orderItems, error: orderItemsError } = await (supabase as any)
    .from('mobile_order_items')
    .select('product_name_snapshot, quantity')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true })

  if (orderItemsError) {
    throw new Error(orderItemsError.message)
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
      throw new Error(failedUpdateError?.message ?? message)
    }

    await (supabase as any).from('mobile_order_audit_logs').insert([
      {
        order_id: orderId,
        actor_user_id: actorUserId,
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

    return failedNotification as MobileOrderNotificationRow
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
          items: (orderItems ?? []).map((item: any) => ({
            productName: String(item.product_name_snapshot ?? '').trim(),
            quantity: Number(item.quantity ?? 0),
          })),
        })
      : notification.notification_type === 'order_preparing'
        ? buildOrderPreparingLineMessages({
            storeName,
            orderNumber: order.order_number,
            pickupNickname: order.pickup_nickname,
          })
        : buildOrderReadyLineMessages({
            storeName,
            orderNumber: order.order_number,
            pickupNickname: order.pickup_nickname,
          })

  try {
    const pushResult = await sendLinePushMessage({
      to: lineUserId,
      messages,
    })

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
      throw new Error(updateError?.message ?? '通知送信の更新に失敗しました')
    }

    await (supabase as any).from('mobile_order_audit_logs').insert([
      {
        order_id: orderId,
        actor_user_id: actorUserId,
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

    return updatedNotification as MobileOrderNotificationRow
  } catch (error) {
    return await failNotification(error instanceof Error ? error.message : 'LINE送信に失敗しました')
  }
}
