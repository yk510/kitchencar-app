import { isStorePosOrder, resolveMobileOrderPaymentMethod } from '@/lib/mobile-order-fields'
import { sendMobileOrderLineNotification } from '@/lib/mobile-order-notifications'
import {
  loadVendorOwnedNotification,
  loadVendorOwnedOrder,
} from '@/lib/vendor-mobile-order-dashboard-api'
import type {
  MobileOrderNotificationRow,
  MobileOrderRow,
  VendorMobileOrderOrderMutationPayload,
} from '@/types/api-payloads'

type SupabaseClientLike = any
type UserLike = { id: string }

const ALLOWED_STATUSES = ['placed', 'preparing', 'ready', 'picked_up', 'cancelled'] as const

const STATUS_TRANSITIONS: Record<string, string[]> = {
  placed: ['preparing', 'ready', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['picked_up'],
  picked_up: [],
  cancelled: [],
}

export function validateOrderMutationInput(body: any) {
  const action = String(body.action ?? '').trim()
  const nextStatus = String(body.status ?? '').trim()

  if (!action && !ALLOWED_STATUSES.includes(nextStatus as (typeof ALLOWED_STATUSES)[number])) {
    throw new Error('不正な注文ステータスです')
  }

  return {
    action,
    nextStatus,
  }
}

async function updateOrderPaymentReceipt(
  supabase: SupabaseClientLike,
  orderId: string,
  actorUserId: string
) {
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
  if (result.error && (message.includes('paid_at') || message.includes('accepted_by_user_id'))) {
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

export async function receiveVendorOrderPayment(
  supabase: SupabaseClientLike,
  user: UserLike,
  orderId: string
): Promise<VendorMobileOrderOrderMutationPayload> {
  const currentOrder = await loadVendorOwnedOrder(supabase, user, orderId)

  if (!isStorePosOrder(currentOrder)) {
    throw new Error('POS注文以外では料金受領できません')
  }

  if (currentOrder.payment_status === 'paid') {
    throw new Error('この注文はすでに受領済みです')
  }

  const { data: paidOrder, error } = await updateOrderPaymentReceipt(supabase, currentOrder.id, user.id)

  if (error || !paidOrder) {
    throw new Error(error?.message ?? '料金受領の更新に失敗しました')
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
        payment_method: resolveMobileOrderPaymentMethod(currentOrder),
        received_at: new Date().toISOString(),
      },
    },
  ])

  return paidOrder as VendorMobileOrderOrderMutationPayload
}

export async function changeVendorOrderStatus(
  supabase: SupabaseClientLike,
  user: UserLike,
  orderId: string,
  nextStatus: string
): Promise<VendorMobileOrderOrderMutationPayload> {
  const currentOrder = await loadVendorOwnedOrder(supabase, user, orderId)
  const allowedNext = STATUS_TRANSITIONS[currentOrder.status] ?? []

  if (!allowedNext.includes(nextStatus)) {
    throw new Error('この注文ステータスには変更できません')
  }

  const patch: Record<string, unknown> = { status: nextStatus }

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
    .eq('id', orderId)
    .select('*')
    .single()

  if (updateError || !updatedOrder) {
    throw new Error(updateError?.message ?? '注文更新に失敗しました')
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
      throw new Error(notificationLookupError.message)
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
        throw new Error(insertNotificationError?.message ?? '通知の作成に失敗しました')
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
      console.error(
        '[vendor-mobile-order-dashboard-mutations] failed to auto-send notification',
        notificationSendError
      )
    }
  }

  return updatedOrder as VendorMobileOrderOrderMutationPayload
}

export async function sendVendorOrderNotification(
  supabase: SupabaseClientLike,
  user: UserLike,
  orderId: string,
  notificationId: string
): Promise<MobileOrderNotificationRow> {
  await loadVendorOwnedNotification(supabase, user, orderId, notificationId)

  const updatedNotification = await sendMobileOrderLineNotification({
    supabase,
    orderId,
    notificationId,
    actorUserId: user.id,
  })

  return updatedNotification as MobileOrderNotificationRow
}
