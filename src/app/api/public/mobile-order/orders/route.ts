import { NextRequest } from 'next/server'
import { apiError, apiOk } from '@/lib/api-response'
import { createPreparedMobileOrder, preparePublicOrderDraft } from '@/lib/mobile-order-ordering'
import { getStripeClient, getStripeConfigStatus } from '@/lib/stripe'
import { createServerSupabaseClient } from '@/lib/supabase'
import type {
  PublicMobileOrderCheckoutResponse,
  PublicMobileOrderCreatePayload,
} from '@/types/api-payloads'

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient()

  try {
    const stripeConfig = getStripeConfigStatus()
    if (!stripeConfig.hasSecretKey) {
      return apiError('現在クレジットカード決済の設定中です。少し時間をおいてお試しください。', 503)
    }

    const body = (await req.json()) as PublicMobileOrderCreatePayload
    const draft = await preparePublicOrderDraft(supabase, body)
    const order = await createPreparedMobileOrder(supabase, draft, {
      payment_status: 'pending',
      payment_provider: 'stripe_checkout',
      order_source: 'mobile_order',
      payment_method: 'card_online',
    })

    let checkoutUrl = ''

    try {
      const stripeLineItems: Array<{
        price_data: {
          currency: 'jpy'
          unit_amount: number
          product_data: {
            name: string
            description?: string
          }
        }
        quantity: number
      }> = []

      for (const item of draft.normalizedItems) {
        const optionDescription = Array.from(item.selectedChoicesByGroup.entries())
          .map(([groupId, choices]) => {
            const group = draft.optionGroupMap.get(groupId)
            if (!group || choices.length === 0) return null
            return `${group.name}: ${choices.map((choice) => choice.name).join(' / ')}`
          })
          .filter(Boolean)
          .join(' | ')

        const unitAmount = Math.round(item.lineTotal / item.quantity)
        stripeLineItems.push({
          price_data: {
            currency: 'jpy',
            unit_amount: unitAmount,
            product_data: {
              name: item.product.name,
              ...(optionDescription ? { description: optionDescription } : {}),
            },
          },
          quantity: item.quantity,
        })
      }

      const stripe = getStripeClient()
      const successUrl = `${req.nextUrl.origin}/order/${draft.orderPage.public_token}?checkout_session_id={CHECKOUT_SESSION_ID}&order_id=${order.id}`
      const cancelUrl = `${req.nextUrl.origin}/order/${draft.orderPage.public_token}?checkout_cancelled=1`
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: stripeLineItems,
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          order_id: order.id,
          public_token: draft.orderPage.public_token,
          store_id: draft.store.id,
          schedule_id: draft.activeSchedule.id,
        },
        payment_intent_data: {
          metadata: {
            order_id: order.id,
            public_token: draft.orderPage.public_token,
          },
        },
      })

      if (!session.url) {
        throw new Error('決済ページURLの生成に失敗しました')
      }
      checkoutUrl = session.url

      const { error: paymentReferenceUpdateError } = await (supabase as any)
        .from('mobile_orders')
        .update({
          payment_reference: session.id,
        })
        .eq('id', order.id)

      if (paymentReferenceUpdateError) {
        throw new Error(paymentReferenceUpdateError.message)
      }
    } catch (nestedError) {
      await (supabase as any).from('mobile_orders').delete().eq('id', order.id)
      throw nestedError
    }

    const payload: PublicMobileOrderCheckoutResponse = {
      order_id: order.id,
      checkout_url: checkoutUrl,
    }

    return apiOk(payload)
  } catch (error) {
    console.error('[public/mobile-order/orders POST]', error)
    return apiError(error instanceof Error ? error.message : 'サーバーエラー')
  }
}
