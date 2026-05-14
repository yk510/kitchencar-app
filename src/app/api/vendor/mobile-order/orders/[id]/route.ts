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

function isStorePosOrder(order: { payment_provider?: string | null }) {
  return String(order.payment_provider ?? '').startsWith('store_pos_')
}

async function updateOrderPaymentReceipt(supabase: any, orderId: string, actorUserId: string) {
  const paidAt = new Date().toISOString()
  const fullPatch = {
    payment_status: 'paid',
    paid_at: paidAt,
    accepted_by_user_id: actorUserId,
  }

  let result = await supabase
    .from('mobile_orders')
    .update(fullPatch)
    .eq('id', orderId)
    .select('*')
    .single()

  const message = String(result.error?.message ?? '')
  if (
    result.error &&
    (message.includes('paid_at') || message.includes('accepted_by_user_id'))
  ) {
    result = await supabase
      .from('mobile_orders')
      .update({
        payment_status: 'paid',
      })
      .eq('id', orderId)
      .select('*')
      .single()
  }

  return result
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
    const action = String(body.action ?? '').trim()
    const nextStatus = String(body.status ?? '').trim()

    if (!action && !ALLOWED_STATUSES.includes(nextStatus as (typeof ALLOWED_STATUSES)[number])) {
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

    if (action === 'receive_payment') {
      if (!isStorePosOrder(currentOrder)) {
        return apiError('POS注文以外では料金受領できません', 409)
      }

      if (currentOrder.payment_status === 'paid') {
        return apiError('この注文はすでに受領済みです', 409)
      }

      const { data: paidOrder, error: paymentUpdateError } = await updateOrderPaymentReceipt(
        supabase,
        currentOrder.id,
        user.id
      )

      if (paymentUpdateError || !paidOrder) {
        return apiError(paymentUpdateError?.message ?? '料金受領の更新に失敗しました')
      }

      await (supabase as any).from('mobile_order_audit_logs').insert([
        {
          order_id: currentOrder.id,
          actor_user_id: user.id,
          action_type: 'payment_received',
          before_status: currentOrder.payment_status,
          after_status: 'paid',
          payload: {
            payment_provider: currentOrder.payment_provider,
            received_at: new Date().toISOString(),
          },
        },
      ])

      const payload: VendorMobileOrderOrderMutationPayload = paidOrder
      return apiOk(payload)
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
