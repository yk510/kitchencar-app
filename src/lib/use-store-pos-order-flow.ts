'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import { ApiClientError, fetchApi } from '@/lib/api-client'
import { buildPublicOrderStepUrl } from '@/lib/public-order-flow'
import {
  buildDefaultStorePosPaymentMethods,
  type StorePosCartItem,
  type StorePosCreateResponse,
  type SubmittedStorePosOrder,
} from '@/lib/store-pos-ui'
import type {
  PublicMobileOrderPagePayload,
  StorePosCreatePayload,
  StorePosPaymentMethod,
} from '@/types/api-payloads'

type UseStorePosOrderFlowArgs = {
  pageData: PublicMobileOrderPagePayload
  cartItems: StorePosCartItem[]
  clearCart: () => void
  setSubmitError: Dispatch<SetStateAction<string | null>>
  setSubmittedOrder: Dispatch<SetStateAction<SubmittedStorePosOrder | null>>
}

export function useStorePosOrderFlow({
  pageData,
  cartItems,
  clearCart,
  setSubmitError,
  setSubmittedOrder,
}: UseStorePosOrderFlowArgs) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<StorePosPaymentMethod>('cash')
  const [submitting, setSubmitting] = useState(false)
  const [confirmingPage, setConfirmingPage] = useState(false)

  const isConfirmStep = searchParams.get('step') === 'confirm'
  const paymentMethods = useMemo(() => buildDefaultStorePosPaymentMethods(pageData.store), [pageData.store])

  useEffect(() => {
    if (!paymentMethods.includes(selectedPaymentMethod)) {
      setSelectedPaymentMethod(paymentMethods[0] ?? 'cash')
    }
  }, [paymentMethods, selectedPaymentMethod])

  useEffect(() => {
    if (isConfirmStep) {
      setConfirmingPage(false)
    }
  }, [isConfirmStep])

  function handleClearCart() {
    clearCart()
    setSubmitError(null)

    if (isConfirmStep) {
      router.replace(pathname, { scroll: true })
    }
  }

  function openConfirmPage() {
    if (cartItems.length === 0) {
      setSubmitError('商品を1件以上追加してください')
      return
    }
    setSubmitError(null)
    setConfirmingPage(true)
    router.push(buildPublicOrderStepUrl(pathname, searchParams.toString(), 'confirm'), { scroll: true })
  }

  function returnToProductSelection() {
    setConfirmingPage(false)
    router.push(buildPublicOrderStepUrl(pathname, searchParams.toString(), 'menu'), { scroll: true })
  }

  async function handleSubmitOrder() {
    if (!pageData.activeSchedule) {
      setSubmitError('現在は注文受付時間外です')
      return
    }

    if (cartItems.length === 0) {
      setSubmitError('商品を1件以上追加してください')
      return
    }

    setSubmitting(true)
    setSubmitError(null)

    try {
      const payload: StorePosCreatePayload = {
        public_token: pageData.orderPage.public_token,
        pickup_nickname: '店頭POS',
        payment_method: selectedPaymentMethod,
        pos_device_label: pageData.store.store_pos_terminal_name ?? 'front-tablet',
        items: cartItems.map((item) => ({
          product_id: item.product_id,
          quantity: item.quantity,
          selected_option_choice_ids: item.selected_option_choice_ids,
        })),
      }

      const response = await fetchApi<StorePosCreateResponse>('/api/public/store-pos/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      setSubmittedOrder({
        ...response,
        status: 'placed',
        paid_at: null,
        cancelled_at: null,
        ordered_at: new Date().toISOString(),
      })
    } catch (error) {
      setSubmitError(error instanceof ApiClientError ? error.message : '注文の作成に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  return {
    selectedPaymentMethod,
    setSelectedPaymentMethod,
    submitting,
    confirmingPage,
    setConfirmingPage,
    isConfirmStep,
    paymentMethods,
    handleClearCart,
    openConfirmPage,
    returnToProductSelection,
    handleSubmitOrder,
  }
}
