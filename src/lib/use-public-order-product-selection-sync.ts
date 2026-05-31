'use client'

import { useEffect, type Dispatch, type SetStateAction } from 'react'
import {
  buildResolvedSelectionState,
  resolveSelectedProduct,
} from '@/lib/public-order-flow'
import type { PublicOrderProductSelection } from '@/lib/public-order-cart'
import type { PublicMobileOrderProduct } from '@/types/api-payloads'

type UsePublicOrderProductSelectionSyncArgs = {
  products: PublicMobileOrderProduct[]
  selectedProduct: PublicMobileOrderProduct | null
  setSelectedProduct: Dispatch<SetStateAction<PublicMobileOrderProduct | null>>
  setSelection: Dispatch<SetStateAction<PublicOrderProductSelection | null>>
  initialPreferredProducts?: PublicMobileOrderProduct[]
  activePreferredProducts?: PublicMobileOrderProduct[]
}

export function usePublicOrderProductSelectionSync({
  products,
  selectedProduct,
  setSelectedProduct,
  setSelection,
  initialPreferredProducts,
  activePreferredProducts,
}: UsePublicOrderProductSelectionSyncArgs) {
  useEffect(() => {
    if (!selectedProduct) return

    if (
      activePreferredProducts &&
      activePreferredProducts.length > 0 &&
      !activePreferredProducts.some((product) => product.id === selectedProduct.id)
    ) {
      const nextState = buildResolvedSelectionState(products, selectedProduct.id, activePreferredProducts)
      setSelectedProduct(nextState.product)
      setSelection(nextState.selection)
      return
    }

    const nextSelected = resolveSelectedProduct(products, selectedProduct.id)
    if (!nextSelected) {
      setSelectedProduct(null)
      setSelection(null)
      return
    }

    setSelectedProduct(nextSelected)
  }, [activePreferredProducts, products, selectedProduct, setSelectedProduct, setSelection])

  useEffect(() => {
    if (selectedProduct) return

    const nextState = buildResolvedSelectionState(products, null, initialPreferredProducts)
    if (!nextState.product) return

    setSelectedProduct(nextState.product)
    setSelection(nextState.selection)
  }, [initialPreferredProducts, products, selectedProduct, setSelectedProduct, setSelection])
}
