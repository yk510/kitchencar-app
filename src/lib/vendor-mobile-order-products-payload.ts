import type { MobileOrderProductRow, VendorMobileOrderProductMutationPayload } from '@/types/api-payloads'

export function normalizeDisplayCategory(value: unknown) {
  return value === 'main' || value === 'side' || value === 'drink' || value === 'other' ? value : 'other'
}

export function normalizeProductDisplayCategory(value: unknown) {
  return normalizeDisplayCategory(value)
}

export function normalizeProductRecord(product: MobileOrderProductRow): VendorMobileOrderProductMutationPayload {
  return {
    ...product,
    display_category: normalizeDisplayCategory(product.display_category),
    is_recommended: typeof product.is_recommended === 'boolean' ? product.is_recommended : false,
  }
}
