import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { sendMobileOrderLineNotification } from '@/lib/mobile-order-notifications'
import { getStripeClient, getStripeConfigStatus } from '@/lib/stripe'
import { createServerSupabaseClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  const stripeConfig = getStripeConfigStatus()
  if (!stripeConfig.hasSecretKey || !stripeConfig.hasWebhookSecret) {
    return new Response('Stripe webhook is not configured', { status: 503 })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return new Response('Missing stripe signature', { status: 400 })
  }

  const payload = await req.text()
  const stripe = getStripeClient()
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!.trim()

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret)
  } catch (error) {
    return new Response(`Webhook Error: ${error instanceof Error ? error.message : 'invalid signature'}`, {
      status: 400,
    })
  }

  const supabase = createServerSupabaseClient()

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session
      const orderId = String(session.metadata?.order_id ?? '').trim()

      if (orderId) {
        const { data: order, error: orderError } = await (supabase as any)
          .from('mobile_orders')
          .select('id, payment_status, payment_reference')
          .eq('id', orderId)
          .maybeSingle()

        if (orderError) {
          throw new Error(orderError.message)
        }

        if (order && order.payment_status !== 'paid') {
          const { error: updateError } = await (supabase as any)
            .from('mobile_orders')
            .update({
              payment_status: 'paid',
              payment_reference: session.id,
            })
            .eq('id', orderId)

          if (updateError) {
            throw new Error(updateError.message)
          }

          const { data: existingNotification, error: notificationLookupError } = await (supabase as any)
            .from('mobile_order_notifications')
            .select('id')
            .eq('order_id', orderId)
            .eq('notification_type', 'order_completed')
            .maybeSingle()

          if (notificationLookupError) {
            throw new Error(notificationLookupError.message)
          }

          let notificationId = existingNotification?.id ?? null
          if (!notificationId) {
            const { data: insertedNotification, error: insertNotificationError } = await (supabase as any)
              .from('mobile_order_notifications')
              .insert([
                {
                  order_id: orderId,
                  notification_type: 'order_completed',
                  delivery_status: 'pending',
                  error_message: null,
                },
              ])
              .select('id')
              .single()

            if (insertNotificationError || !insertedNotification) {
              throw new Error(insertNotificationError?.message ?? '注文完了通知の作成に失敗しました')
            }

            notificationId = insertedNotification.id
          }

          if (notificationId) {
            await sendMobileOrderLineNotification({
              supabase,
              orderId,
              notificationId,
              actorUserId: null,
            })
          }

          await (supabase as any).from('mobile_order_audit_logs').insert([
            {
              order_id: orderId,
              actor_user_id: null,
              action_type: 'payment_completed',
              before_status: order.payment_status,
              after_status: 'paid',
              payload: {
                stripe_event_id: event.id,
                checkout_session_id: session.id,
                payment_status: session.payment_status,
              },
            },
          ])
        }
      }
    }

    if (event.type === 'checkout.session.expired') {
      const session = event.data.object as Stripe.Checkout.Session
      const orderId = String(session.metadata?.order_id ?? '').trim()

      if (orderId) {
        await (supabase as any)
          .from('mobile_orders')
          .update({
            payment_status: 'failed',
          })
          .eq('id', orderId)
          .eq('payment_status', 'pending')
      }
    }

    return new Response('ok', { status: 200 })
  } catch (error) {
    console.error('[stripe/webhook POST]', error)
    return new Response('Webhook handler failed', { status: 500 })
  }
}
