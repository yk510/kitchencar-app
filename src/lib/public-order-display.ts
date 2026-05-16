import type { PublicOrderSelectedOptionGroup } from '@/lib/public-order-cart'
import type { StorePosPaymentMethod } from '@/types/api-payloads'

export type PublicOrderDisplayItem = {
  id: string
  product_name: string
  quantity: number
  line_total: number
  unit_price?: number
  selected_options: PublicOrderSelectedOptionGroup[]
}

export function formatPublicOrderPrice(value: number) {
  return `${value.toLocaleString()} 円`
}

export function formatPublicOrderCartSummary(items: PublicOrderDisplayItem[]) {
  if (items.length === 0) {
    return 'まだ商品が入っていません'
  }

  return items.map((item) => `${item.product_name} × ${item.quantity}`).join(' / ')
}

export function formatPublicOrderItemMeta(item: PublicOrderDisplayItem) {
  if (typeof item.unit_price === 'number') {
    return `${formatPublicOrderPrice(item.unit_price)} / 1点 ・ 数量 ${item.quantity}`
  }

  return `数量 ${item.quantity}`
}

export function formatPublicOrderOptionGroupLine(group: PublicOrderSelectedOptionGroup) {
  return `${group.group_name}: ${group.choices.map((choice) => choice.choice_name).join(' / ')}`
}

export function formatStorePosPaymentMethodLabel(method: StorePosPaymentMethod) {
  if (method === 'cash') return '現金'
  if (method === 'paypay') return 'PayPay'
  return 'その他'
}
