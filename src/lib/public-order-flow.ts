import { buildInitialProductSelection } from '@/lib/public-order-cart'
import type { PublicMobileOrderProduct } from '@/types/api-payloads'

export type PublicOrderStep = 'menu' | 'cart' | 'review' | 'confirm'

export function buildPublicOrderStepUrl(
  pathname: string,
  currentSearch: string,
  step: PublicOrderStep
) {
  const params = new URLSearchParams(currentSearch)

  if (step === 'menu') {
    params.delete('step')
    params.delete('checkout_session_id')
    params.delete('order_id')
    params.delete('checkout_cancelled')
  } else {
    params.set('step', step)
  }

  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}

export function resolveSelectedProduct(
  products: PublicMobileOrderProduct[],
  currentProductId: string | null | undefined,
  preferredProducts?: PublicMobileOrderProduct[]
) {
  if (currentProductId) {
    const matched = products.find((product) => product.id === currentProductId) ?? null
    if (matched) {
      return matched
    }
  }

  if (preferredProducts && preferredProducts.length > 0) {
    return preferredProducts[0]
  }

  return products[0] ?? null
}

export function buildResolvedSelectionState(
  products: PublicMobileOrderProduct[],
  currentProductId: string | null | undefined,
  preferredProducts?: PublicMobileOrderProduct[]
) {
  const product = resolveSelectedProduct(products, currentProductId, preferredProducts)
  return {
    product,
    selection: product ? buildInitialProductSelection(product) : null,
  }
}
