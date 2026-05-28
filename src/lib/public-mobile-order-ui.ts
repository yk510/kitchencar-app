import { getPublicOrderProductUnavailableState } from '@/lib/public-order-cart'
import type { PublicMobileOrderProduct } from '@/types/api-payloads'

export const publicOrderPrimaryCtaClassName =
  'rounded-full bg-[var(--accent-blue)] px-5 py-3 text-sm font-semibold text-white shadow-[0_14px_30px_rgba(37,99,235,0.24)] transition active:translate-y-[1px] active:scale-[0.99] active:shadow-[0_8px_18px_rgba(37,99,235,0.18)] disabled:cursor-not-allowed disabled:opacity-50'

export const publicOrderSecondaryCtaClassName =
  'rounded-full bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-700 shadow-[inset_0_-1px_0_rgba(148,163,184,0.14)] transition active:translate-y-[1px] active:scale-[0.99] active:bg-slate-200'

export function formatPublicMobileOrderDateTime(value: string) {
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function getPublicMobileOrderUnavailableMessage(product: PublicMobileOrderProduct) {
  const unavailableState = getPublicOrderProductUnavailableState(product)
  if (unavailableState === 'loading') {
    return 'この商品の在庫を確認しています'
  }
  if (unavailableState === 'not_set') {
    return 'この商品は本日分の在庫準備中です'
  }
  return 'この商品は現在売り切れです'
}
