import { NextRequest } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import { sendMobileOrderLineNotification } from '@/lib/mobile-order-notifications'
import type { VendorMobileOrderOrderMutationPayload } from '@/types/api-payloads'

const ALLOWED_STATUSES = ['placed', 'preparing', 'ready', 'picked_up', 'cancelled'] as const

const STATUS_TRANSITIONS: Record<string, string[]> = {
  placed: ['preparing', 'ready', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['picked_up'],
  picked_up: [],
  cancelled: [],
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
    const nextStatus = String(body.status ?? '').trim()

    if (!ALLOWED_STATUSES.includes(nextStatus as (typeof ALLOWED_STATUSES)[number])) {
      return apiError('不正な注文ステータスです', 400)
    }

    const { data: currentOrder, error: currentError } = await (supabase as any)
      .from('mobile_orders')
      .select('*')
      .eq('id', id)
      .single()

    if (currentError || !currentOrder) {
      return apiError('対象の注文が見つかりません', 404)
    }

    const allowedNext = STATUS_TRANSITIONS[currentOrder.status] ?? []
    if (!allowedNext.includes(nextStatus)) {
      return apiError('この注文ステータスには変更できません', 409)
    }

    const patch: Record<string, unknown> = {
      status: nextStatus,
    }

    if (nextStatus === 'ready' && !currentOrder.ready_notified_at) {
      patch.ready_notified_at = new Date().toISOString()
    }

    if (nextStatus === 'picked_up' && !currentOrder.picked_up_at) {
      patch.picked_up_at = new Date().toISOString()
    }

    if (nextStatus === 'cancelled' && !currentOrder.cancelled_at) {
      patch.cancelled_at = new Date().toISOString()
    }

    const { data: updatedOrder, error: updateError } = await (supabase as any)
      .from('mobile_orders')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single()

    if (updateError || !updatedOrder) {
      return apiError(updateError?.message ?? '注文更新に失敗しました')
    }

    let createdNotificationType: 'order_preparing' | 'order_ready' | null = null
    let notificationToSendId: string | null = null

    if (nextStatus === 'preparing' || nextStatus === 'ready') {
      const notificationType = nextStatus === 'preparing' ? 'order_preparing' : 'order_ready'
      const { data: existingNotification, error: notificationLookupError } = await (supabase as any)
        .from('mobile_order_notifications')
        .select('id, delivery_status')
        .eq('order_id', currentOrder.id)
        .eq('notification_type', notificationType)
        .maybeSingle()

      if (notificationLookupError) {
        return apiError(notificationLookupError.message)
      }

      if (!existingNotification) {
        const { data: insertedNotification, error: insertNotificationError } = await (supabase as any)
          .from('mobile_order_notifications')
          .insert([
            {
              order_id: currentOrder.id,
              notification_type: notificationType,
              delivery_status: 'pending',
              error_message: null,
            },
          ])
          .select('id')
          .single()

        if (insertNotificationError || !insertedNotification) {
          return apiError(insertNotificationError?.message ?? '通知の作成に失敗しました')
        }

        createdNotificationType = notificationType
        notificationToSendId = insertedNotification.id
      } else if (existingNotification.delivery_status !== 'sent') {
        notificationToSendId = existingNotification.id
      }
    }

    await (supabase as any).from('mobile_order_audit_logs').insert([
      {
        order_id: currentOrder.id,
        actor_user_id: user.id,
        action_type: 'status_changed',
        before_status: currentOrder.status,
        after_status: nextStatus,
        payload: {
          updated_at: new Date().toISOString(),
        },
      },
    ])

    if (createdNotificationType) {
      await (supabase as any).from('mobile_order_audit_logs').insert([
        {
          order_id: currentOrder.id,
          actor_user_id: user.id,
          action_type: 'notification_queued',
          before_status: null,
          after_status: createdNotificationType,
          payload: {
            notification_type: createdNotificationType,
            delivery_status: 'pending',
          },
        },
      ])
    }

    if (notificationToSendId) {
      try {
        await sendMobileOrderLineNotification({
          supabase,
          orderId: currentOrder.id,
          notificationId: notificationToSendId,
          actorUserId: user.id,
        })
      } catch (notificationSendError) {
        console.error('[vendor/mobile-order/orders/:id PATCH] failed to auto-send notification', notificationSendError)
      }
    }

    const payload: VendorMobileOrderOrderMutationPayload = updatedOrder
    return apiOk(payload)
  } catch (error) {
    console.error('[vendor/mobile-order/orders/:id PATCH]', error)
    return apiError('サーバーエラー')
  }
}
