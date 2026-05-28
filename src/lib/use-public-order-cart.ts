'use client'

import { useCallback, useState } from 'react'
import {
  buildInitialProductSelection,
  buildPublicOrderCartItemCore,
  isPublicOrderProductUnavailable,
  validatePublicOrderSelection,
  type PublicOrderCartItemCore,
  type PublicOrderProductSelection,
} from '@/lib/public-order-cart'
import type { PublicMobileOrderProduct } from '@/types/api-payloads'

export type PublicOrderCartItem = PublicOrderCartItemCore & {
  id: string
}

type UsePublicOrderCartArgs = {
  initialSelectedProduct?: PublicMobileOrderProduct | null
  initialSelection?: PublicOrderProductSelection | null
  getUnavailableMessage?: (product: PublicMobileOrderProduct) => string
  onUnavailableProduct?: (message: string, product: PublicMobileOrderProduct) => void
}

function buildCartItemId(productId: string) {
  return `${productId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function usePublicOrderCart({
  initialSelectedProduct = null,
  initialSelection,
  getUnavailableMessage,
  onUnavailableProduct,
}: UsePublicOrderCartArgs = {}) {
  const [cartItems, setCartItems] = useState<PublicOrderCartItem[]>([])
  const [selectedProduct, setSelectedProduct] = useState<PublicMobileOrderProduct | null>(() => initialSelectedProduct)
  const [selection, setSelection] = useState<PublicOrderProductSelection | null>(() => {
    if (initialSelection !== undefined) return initialSelection
    return initialSelectedProduct ? buildInitialProductSelection(initialSelectedProduct) : null
  })
  const [selectionError, setSelectionError] = useState<string | null>(null)

  const selectProduct = useCallback(
    (product: PublicMobileOrderProduct, options?: { allowUnavailable?: boolean }) => {
      if (!options?.allowUnavailable && isPublicOrderProductUnavailable(product)) {
        const message = getUnavailableMessage?.(product) ?? 'この商品は現在選択できません'
        onUnavailableProduct?.(message, product)
        return false
      }

      setSelectedProduct(product)
      setSelection(buildInitialProductSelection(product))
      setSelectionError(null)
      return true
    },
    [getUnavailableMessage, onUnavailableProduct]
  )

  const toggleChoice = useCallback((group: PublicMobileOrderProduct['option_groups'][number], choiceId: string) => {
    setSelection((current) => {
      if (!current) return current

      const selectedIds = current.selectedChoiceIdsByGroup[group.id] ?? []
      const isSelected = selectedIds.includes(choiceId)
      const nextSelectedIds =
        group.selection_type === 'single'
          ? isSelected
            ? []
            : [choiceId]
          : isSelected
            ? selectedIds.filter((id) => id !== choiceId)
            : [...selectedIds, choiceId]

      return {
        ...current,
        selectedChoiceIdsByGroup: {
          ...current.selectedChoiceIdsByGroup,
          [group.id]: nextSelectedIds,
        },
      }
    })
    setSelectionError(null)
  }, [])

  const updateSelectionQuantity = useCallback((nextQuantity: number) => {
    setSelection((current) => (current ? { ...current, quantity: Math.max(1, nextQuantity) } : current))
    setSelectionError(null)
  }, [])

  const addSelectedProductToCart = useCallback(
    (options?: {
      allowUnavailable?: boolean
      onSuccess?: () => void
    }) => {
      if (!selectedProduct || !selection) return false

      if (!options?.allowUnavailable && isPublicOrderProductUnavailable(selectedProduct)) {
        const message = getUnavailableMessage?.(selectedProduct) ?? 'この商品は現在選択できません'
        onUnavailableProduct?.(message, selectedProduct)
        return false
      }

      const validationError = validatePublicOrderSelection(selectedProduct, selection)
      if (validationError) {
        setSelectionError(validationError)
        return false
      }

      setCartItems((current) => [
        ...current,
        {
          id: buildCartItemId(selectedProduct.id),
          ...buildPublicOrderCartItemCore(selectedProduct, selection),
        },
      ])
      setSelection(buildInitialProductSelection(selectedProduct))
      setSelectionError(null)
      options?.onSuccess?.()
      return true
    },
    [getUnavailableMessage, onUnavailableProduct, selectedProduct, selection]
  )

  const updateCartQuantity = useCallback((itemId: string, nextQuantity: number) => {
    if (nextQuantity <= 0) {
      setCartItems((current) => current.filter((item) => item.id !== itemId))
      return
    }

    setCartItems((current) =>
      current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              quantity: nextQuantity,
              line_total: item.unit_price * nextQuantity,
            }
          : item
      )
    )
  }, [])

  const removeCartItem = useCallback((itemId: string) => {
    setCartItems((current) => current.filter((item) => item.id !== itemId))
  }, [])

  const clearCart = useCallback(() => {
    setCartItems([])
  }, [])

  return {
    cartItems,
    setCartItems,
    selectedProduct,
    setSelectedProduct,
    selection,
    setSelection,
    selectionError,
    setSelectionError,
    selectProduct,
    toggleChoice,
    updateSelectionQuantity,
    addSelectedProductToCart,
    updateCartQuantity,
    removeCartItem,
    clearCart,
  }
}
