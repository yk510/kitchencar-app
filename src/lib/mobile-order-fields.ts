type MobileOrderLike = {
  order_source?: string | null
  orderSource?: string | null
  payment_provider?: string | null
  paymentProvider?: string | null
  payment_method?: string | null
  paymentMethod?: string | null
}

export type ResolvedMobileOrderSource = 'mobile_order' | 'store_pos'
export type ResolvedMobileOrderPaymentMethod = 'card_online' | 'cash' | 'paypay' | 'other' | null

export function isStorePosPaymentProvider(value: string | null | undefined) {
  return String(value ?? '').startsWith('store_pos_')
}

export function resolveMobileOrderSource(order: MobileOrderLike): ResolvedMobileOrderSource {
  const explicitSource = order.order_source ?? order.orderSource
  if (explicitSource === 'store_pos' || explicitSource === 'mobile_order') {
    return explicitSource
  }

  return isStorePosPaymentProvider(order.payment_provider ?? order.paymentProvider) ? 'store_pos' : 'mobile_order'
}

export function isStorePosOrder(order: MobileOrderLike) {
  return resolveMobileOrderSource(order) === 'store_pos'
}

export function resolveMobileOrderPaymentMethod(
  order: MobileOrderLike
): ResolvedMobileOrderPaymentMethod {
  const explicitMethod = order.payment_method ?? order.paymentMethod
  if (
    explicitMethod === 'card_online' ||
    explicitMethod === 'cash' ||
    explicitMethod === 'paypay' ||
    explicitMethod === 'other'
  ) {
    return explicitMethod
  }

  const provider = order.payment_provider ?? order.paymentProvider
  if (provider === 'store_pos_cash') return 'cash'
  if (provider === 'store_pos_paypay') return 'paypay'
  if (provider === 'store_pos_other') return 'other'
  if (provider === 'stripe_checkout') return 'card_online'
  return null
}

export function getStorePosProviderForMethod(method: 'cash' | 'paypay' | 'other') {
  if (method === 'cash') return 'store_pos_cash'
  if (method === 'paypay') return 'store_pos_paypay'
  return 'store_pos_other'
}

export function isMissingMobileOrderExtendedColumnsError(error: unknown) {
  const message = String((error as { message?: string } | null)?.message ?? '')
  return (
    message.includes('order_source') ||
    message.includes('payment_method') ||
    message.includes('paid_at') ||
    message.includes('accepted_by_user_id') ||
    message.includes('pos_device_label')
  )
}
