import { NextRequest } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
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

    if (nextStatus === 'ready') {
      const { data: existingReadyNotification, error: readyNotificationError } = await (supabase as any)
        .from('mobile_order_notifications')
        .select('id')
        .eq('order_id', currentOrder.id)
        .eq('notification_type', 'order_ready')
        .maybeSingle()

      if (readyNotificationError) {
        return apiError(readyNotificationError.message)
      }

      if (!existingReadyNotification) {
        const { error: insertReadyNotificationError } = await (supabase as any)
          .from('mobile_order_notifications')
          .insert([
            {
              order_id: currentOrder.id,
              notification_type: 'order_ready',
              delivery_status: 'pending',
              error_message: 'LINE連携未実装のため未送信',
            },
          ])

        if (insertReadyNotificationError) {
          return apiError(insertReadyNotificationError.message)
        }
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

    if (nextStatus === 'ready') {
      await (supabase as any).from('mobile_order_audit_logs').insert([
        {
          order_id: currentOrder.id,
          actor_user_id: user.id,
          action_type: 'notification_queued',
          before_status: null,
          after_status: 'order_ready',
          payload: {
            notification_type: 'order_ready',
            delivery_status: 'pending',
          },
        },
      ])
    }

    const payload: VendorMobileOrderOrderMutationPayload = updatedOrder
    return apiOk(payload)
  } catch (error) {
    console.error('[vendor/mobile-order/orders/:id PATCH]', error)
    return apiError('サーバーエラー')
  }
}
