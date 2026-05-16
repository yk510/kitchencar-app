import type { MobileOrderProductRow, VendorMobileOrderManagedProduct } from '@/types/api-payloads'

export type ProductForm = {
  name: string
  description: string
  price: string
  image_url: string
  display_category: 'main' | 'side' | 'drink' | 'other'
  is_recommended: boolean
  sort_order: string
  tracks_inventory: boolean
  low_stock_threshold: string
  is_published: boolean
  is_sold_out: boolean
}

export const EMPTY_FORM: ProductForm = {
  name: '',
  description: '',
  price: '',
  image_url: '',
  display_category: 'other',
  is_recommended: false,
  sort_order: '0',
  tracks_inventory: false,
  low_stock_threshold: '3',
  is_published: true,
  is_sold_out: false,
}

export function buildFormFromProduct(product: MobileOrderProductRow): ProductForm {
  return {
    name: product.name,
    description: product.description ?? '',
    price: String(product.price),
    image_url: product.image_url ?? '',
    display_category:
      product.display_category === 'main' ||
      product.display_category === 'side' ||
      product.display_category === 'drink' ||
      product.display_category === 'other'
        ? product.display_category
        : 'other',
    is_recommended: Boolean(product.is_recommended),
    sort_order: String(product.sort_order),
    tracks_inventory: product.tracks_inventory,
    low_stock_threshold: String(product.low_stock_threshold),
    is_published: product.is_published,
    is_sold_out: product.is_sold_out,
  }
}

export function normalizeDisplayCategory(value: string | null | undefined): ProductForm['display_category'] {
  if (value === 'main' || value === 'side' || value === 'drink' || value === 'other') {
    return value
  }
  return 'other'
}

export function formatProductPrice(value: number) {
  return `${value.toLocaleString()} 円`
}

export function formatProductDateTime(value: string) {
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export function formatSignedQuantity(value: number) {
  return value > 0 ? `+${value}` : String(value)
}

export function getCategoryLabel(value: ProductForm['display_category']) {
  if (value === 'main') return 'メイン'
  if (value === 'side') return 'サイド'
  if (value === 'drink') return 'ドリンク'
  return 'その他'
}

export function getInventoryStatusLabel(product: VendorMobileOrderManagedProduct, hasCurrentSchedule: boolean) {
  if (!product.tracks_inventory) {
    return {
      label: '在庫管理なし',
      className: 'bg-slate-100 text-slate-700',
    }
  }

  if (!hasCurrentSchedule) {
    return {
      label: '営業中の枠なし',
      className: 'bg-slate-100 text-slate-700',
    }
  }

  if (product.current_inventory_status === 'not_set') {
    return {
      label: '初期在庫未設定',
      className: 'bg-amber-100 text-amber-800',
    }
  }

  if (product.current_inventory_status === 'sold_out') {
    return {
      label: '売り切れ',
      className: 'bg-rose-100 text-rose-800',
    }
  }

  if (product.current_inventory_status === 'low_stock') {
    return {
      label: `残りわずか (${product.current_remaining_quantity ?? 0})`,
      className: 'bg-orange-100 text-orange-800',
    }
  }

  return {
    label: product.current_remaining_quantity != null ? `残数 ${product.current_remaining_quantity}` : '在庫あり',
    className: 'bg-emerald-50 text-emerald-700',
  }
}
