import {
  getPublicOrderProductUnavailableState,
  type PublicOrderSelectedOptionGroup,
} from '@/lib/public-order-cart'
import type {
  PublicMobileOrderPagePayload,
  PublicMobileOrderProduct,
  StorePosPaymentMethod,
} from '@/types/api-payloads'

export type StorePosCartItem = {
  id: string
  product_id: string
  product_name: string
  unit_price: number
  quantity: number
  line_total: number
  selected_option_choice_ids: string[]
  selected_options: PublicOrderSelectedOptionGroup[]
}

export type StorePosCreateResponse = {
  order_id: string
  order_number: string
  payment_status: 'pending' | 'paid'
  payment_method: StorePosPaymentMethod
  total_amount: number
}

export type SubmittedStorePosOrder = StorePosCreateResponse & {
  status: 'placed' | 'cancelled'
  paid_at: string | null
  cancelled_at: string | null
  ordered_at: string
}

export type ProductDisplayCategory = 'main' | 'side' | 'drink' | 'other'
export type ProductFilterKey = 'all' | 'recommended' | ProductDisplayCategory

export const primaryButtonClassName =
  'inline-flex items-center justify-center rounded-[28px] bg-[var(--accent-blue)] px-6 py-4 text-base font-semibold text-white shadow-[0_14px_32px_rgba(37,99,235,0.28)] transition hover:brightness-[1.03] disabled:cursor-not-allowed disabled:opacity-50'
export const secondaryButtonClassName =
  'inline-flex items-center justify-center rounded-[28px] bg-white px-6 py-4 text-base font-semibold text-slate-700 ring-1 ring-[var(--line-soft)] transition hover:bg-slate-50'

function normalizeText(value: string | null | undefined) {
  return String(value ?? '').toLowerCase()
}

export function inferStorePosProductCategory(product: PublicMobileOrderProduct): ProductDisplayCategory {
  if (
    product.display_category === 'main' ||
    product.display_category === 'side' ||
    product.display_category === 'drink' ||
    product.display_category === 'other'
  ) {
    return product.display_category
  }

  const source = `${normalizeText(product.name)} ${normalizeText(product.description)}`

  if (
    source.includes('ラッシー') ||
    source.includes('コーヒー') ||
    source.includes('ドリンク') ||
    source.includes('ジュース') ||
    source.includes('ティー') ||
    source.includes('ソーダ') ||
    source.includes('drink')
  ) {
    return 'drink'
  }

  if (
    source.includes('ポテト') ||
    source.includes('サイド') ||
    source.includes('トッピング') ||
    source.includes('副菜') ||
    source.includes('セット') ||
    source.includes('side')
  ) {
    return 'side'
  }

  if (
    source.includes('カレー') ||
    source.includes('丼') ||
    source.includes('メイン') ||
    source.includes('プレート') ||
    source.includes('main') ||
    source.includes('スペシャル')
  ) {
    return 'main'
  }

  return 'other'
}

export function isStorePosRecommendedProduct(product: PublicMobileOrderProduct, index: number) {
  if (typeof product.is_recommended === 'boolean') {
    return product.is_recommended
  }

  const source = `${normalizeText(product.name)} ${normalizeText(product.description)}`
  return (
    source.includes('おすすめ') ||
    source.includes('人気') ||
    source.includes('定番') ||
    source.includes('スペシャル') ||
    index < 2
  )
}

export function getStorePosCategoryLabel(category: ProductFilterKey) {
  switch (category) {
    case 'all':
      return 'すべて'
    case 'recommended':
      return 'おすすめ'
    case 'main':
      return 'メイン'
    case 'side':
      return 'サイド'
    case 'drink':
      return 'ドリンク'
    default:
      return 'その他'
  }
}

export function getDefaultStorePosProductFilter(
  products: PublicMobileOrderProduct[]
): ProductFilterKey {
  const categorizedProducts = products.map((product, index) => ({
    category: inferStorePosProductCategory(product),
    recommended: isStorePosRecommendedProduct(product, index),
  }))

  if (categorizedProducts.some((entry) => entry.recommended)) {
    return 'recommended'
  }

  if (categorizedProducts.some((entry) => entry.category === 'main')) {
    return 'main'
  }

  return 'all'
}

export function getInitialStorePosSelectedProduct(
  products: PublicMobileOrderProduct[],
  filter: ProductFilterKey
): PublicMobileOrderProduct | null {
  const categorizedProducts = products.map((product, index) => ({
    product,
    category: inferStorePosProductCategory(product),
    recommended: isStorePosRecommendedProduct(product, index),
  }))

  const filteredProducts =
    filter === 'all'
      ? categorizedProducts
      : filter === 'recommended'
        ? categorizedProducts.filter((entry) => entry.recommended)
        : categorizedProducts.filter((entry) => entry.category === filter)

  return filteredProducts[0]?.product ?? products[0] ?? null
}

export function buildDefaultStorePosPaymentMethods(
  store: PublicMobileOrderPagePayload['store']
): StorePosPaymentMethod[] {
  const values = Array.isArray(store.store_pos_enabled_payment_methods)
    ? store.store_pos_enabled_payment_methods
    : ['cash', 'paypay']
  return values.filter((value): value is StorePosPaymentMethod =>
    ['cash', 'paypay', 'other'].includes(value)
  )
}

export function getStorePosUnavailableMessage(product: PublicMobileOrderProduct) {
  const unavailableState = getPublicOrderProductUnavailableState(product)
  if (unavailableState === 'loading') {
    return 'この商品の在庫を確認しているため、カートに追加できません。'
  }
  if (unavailableState === 'not_set') {
    return 'この商品は現在在庫準備中のため、カートに追加できません。'
  }
  return 'この商品は現在売り切れのため、カートに追加できません。'
}

export function buildStorePosReceiptPrintFailureMessage(errorMessage?: string | null) {
  const detail = errorMessage ? ` 詳細: ${errorMessage}` : ''
  return `お支払いは完了しましたが、プリンターに接続できません。店員の方はプリンターの電源とBluetooth接続を確認してください。印刷に失敗しました。必要に応じて注文管理画面から再印刷してください。${detail} 10秒後に次の注文画面へ戻ります。`
}
