'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  getDefaultStorePosProductFilter,
  inferStorePosProductCategory,
  isStorePosRecommendedProduct,
  type ProductFilterKey,
} from '@/lib/store-pos-ui'
import type { PublicMobileOrderProduct } from '@/types/api-payloads'

type UseStorePosProductFiltersArgs = {
  products: PublicMobileOrderProduct[]
  initialProducts: PublicMobileOrderProduct[]
  selectedProductId: string | null | undefined
}

export function useStorePosProductFilters({
  products,
  initialProducts,
  selectedProductId,
}: UseStorePosProductFiltersArgs) {
  const [activeFilter, setActiveFilter] = useState<ProductFilterKey>(() =>
    getDefaultStorePosProductFilter(initialProducts)
  )

  const categorizedProducts = useMemo(
    () =>
      products.map((product, index) => ({
        product,
        category: inferStorePosProductCategory(product),
        recommended: isStorePosRecommendedProduct(product, index),
      })),
    [products]
  )

  const getProductsForFilter = useCallback(
    (filter: ProductFilterKey) => {
      if (filter === 'all') return categorizedProducts.map((entry) => entry.product)
      if (filter === 'recommended') {
        return categorizedProducts.filter((entry) => entry.recommended).map((entry) => entry.product)
      }
      return categorizedProducts.filter((entry) => entry.category === filter).map((entry) => entry.product)
    },
    [categorizedProducts]
  )

  const filteredProducts = useMemo(
    () => getProductsForFilter(activeFilter),
    [activeFilter, getProductsForFilter]
  )

  const selectedProductIsRecommended = useMemo(
    () => categorizedProducts.some((entry) => entry.product.id === selectedProductId && entry.recommended),
    [categorizedProducts, selectedProductId]
  )

  return {
    activeFilter,
    setActiveFilter,
    categorizedProducts,
    filteredProducts,
    selectedProductIsRecommended,
    getProductsForFilter,
  }
}
