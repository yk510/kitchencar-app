'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { ApiClientError, fetchApi } from '@/lib/api-client'
import { buildPublicOrderStepUrl } from '@/lib/public-order-flow'
import type { PublicOrderCartItem } from '@/lib/use-public-order-cart'
import type {
  PublicMobileOrderCheckoutResponse,
  PublicMobileOrderCheckoutStatusResponse,
  PublicMobileOrderPagePayload,
} from '@/types/api-payloads'

const LIFF_ORDER_CONTEXT_STORAGE_KEY = 'mobile-order:liff-context'

function getStoredLiffOrderContext() {
  if (typeof window === 'undefined') {
    return {
      lineUserId: '',
      lineDisplayName: '',
    }
  }

  try {
    const rawValue = window.sessionStorage.getItem(LIFF_ORDER_CONTEXT_STORAGE_KEY)
    if (!rawValue) {
      return {
        lineUserId: '',
        lineDisplayName: '',
      }
    }

    const parsed = JSON.parse(rawValue) as {
      lineUserId?: string | null
      lineDisplayName?: string | null
    }

    return {
      lineUserId: String(parsed.lineUserId ?? '').trim(),
      lineDisplayName: String(parsed.lineDisplayName ?? '').trim(),
    }
  } catch {
    return {
      lineUserId: '',
      lineDisplayName: '',
    }
  }
}

type PublicMobileOrderStep = 'menu' | 'cart' | 'review'

type UsePublicMobileOrderCheckoutArgs = {
  pageData: PublicMobileOrderPagePayload
  cartItems: PublicOrderCartItem[]
  pickupNickname: string
  setCartItems: Dispatch<SetStateAction<PublicOrderCartItem[]>>
  setPickupNickname: Dispatch<SetStateAction<string>>
  setSelectionError: Dispatch<SetStateAction<string | null>>
  onRefreshInventory: () => Promise<void>
}

export function usePublicMobileOrderCheckout({
  pageData,
  cartItems,
  pickupNickname,
  setCartItems,
  setPickupNickname,
  setSelectionError,
  onRefreshInventory,
}: UsePublicMobileOrderCheckoutArgs) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [completedOrder, setCompletedOrder] = useState<PublicMobileOrderCheckoutStatusResponse | null>(null)
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false)
  const [showPaymentConfirmModal, setShowPaymentConfirmModal] = useState(false)
  const [transitioningStep, setTransitioningStep] = useState<'cart' | 'review' | null>(null)

  const stepParam = searchParams.get('step')
  const currentStep: PublicMobileOrderStep = stepParam === 'review' ? 'review' : stepParam === 'cart' ? 'cart' : 'menu'

  const replaceStep = useCallback(
    (step: PublicMobileOrderStep) => {
      const nextUrl = buildPublicOrderStepUrl(pathname, searchParams.toString(), step)
      if (typeof window !== 'undefined') {
        window.history.replaceState(null, '', nextUrl)
      }
      router.replace(nextUrl, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  const resetToOrderPage = useCallback(() => {
    setCompletedOrder(null)
    setCheckoutError(null)
    setIsVerifyingPayment(false)
    setCartItems([])
    setPickupNickname('')
    setSelectionError(null)
    if (typeof window !== 'undefined') {
      window.location.replace(pathname)
      return
    }
    router.replace(pathname, { scroll: false })
  }, [pathname, router, setCartItems, setPickupNickname, setSelectionError])

  useEffect(() => {
    if ((currentStep === 'cart' || currentStep === 'review') && cartItems.length === 0) {
      replaceStep('menu')
    }
  }, [cartItems.length, currentStep, replaceStep])

  useEffect(() => {
    setTransitioningStep(null)
  }, [currentStep])

  useEffect(() => {
    const checkoutSessionId = searchParams.get('checkout_session_id')?.trim() ?? ''
    const orderId = searchParams.get('order_id')?.trim() ?? ''
    const checkoutCancelled = searchParams.get('checkout_cancelled') === '1'

    if (checkoutCancelled) {
      setCheckoutError('決済はまだ完了していません。商品を選び直して、もう一度お支払いください。')
      replaceStep('menu')
      return
    }

    if (!checkoutSessionId || !orderId || completedOrder) {
      return
    }

    let disposed = false
    let attemptCount = 0

    async function verifyCheckout() {
      if (disposed) return
      attemptCount += 1
      setIsVerifyingPayment(true)
      setCheckoutError(null)

      try {
        const response = await fetchApi<PublicMobileOrderCheckoutStatusResponse>(
          `/api/public/mobile-order/orders/checkout-status?public_token=${encodeURIComponent(pageData.orderPage.public_token)}&order_id=${encodeURIComponent(orderId)}&checkout_session_id=${encodeURIComponent(checkoutSessionId)}`,
          { cache: 'no-store' }
        )

        if (response.payment_status === 'paid' || response.payment_status === 'authorized') {
          if (disposed) return
          setCompletedOrder(response)
          setCartItems([])
          setPickupNickname('')
          replaceStep('menu')
          setIsVerifyingPayment(false)
          await onRefreshInventory()
          return
        }

        if (attemptCount < 12) {
          window.setTimeout(() => {
            void verifyCheckout()
          }, 1500)
          return
        }

        setCheckoutError('決済完了の確認に少し時間がかかっています。少し待ってから画面を開き直してください。')
      } catch (error) {
        setCheckoutError(error instanceof ApiClientError ? error.message : '決済確認に失敗しました')
      } finally {
        if (!disposed) {
          setIsVerifyingPayment(false)
        }
      }
    }

    void verifyCheckout()

    return () => {
      disposed = true
    }
  }, [
    completedOrder,
    onRefreshInventory,
    pageData.orderPage.public_token,
    replaceStep,
    searchParams,
    setCartItems,
    setPickupNickname,
  ])

  const handleStartReview = useCallback(() => {
    if (cartItems.length === 0) {
      setCheckoutError('商品を1件以上カートに追加してください')
      return
    }

    if (!pickupNickname.trim()) {
      setCheckoutError('受け取りニックネームを入力してください')
      return
    }

    setCheckoutError(null)
    setTransitioningStep('review')
    replaceStep('review')
  }, [cartItems.length, pickupNickname, replaceStep])

  const handleGoToCart = useCallback(() => {
    if (cartItems.length === 0) {
      setCheckoutError('商品を1件以上カートに追加してください')
      return
    }

    setCheckoutError(null)
    setTransitioningStep('cart')
    replaceStep('cart')
  }, [cartItems.length, replaceStep])

  const handleSubmitOrder = useCallback(async () => {
    if (!pageData.activeSchedule) {
      setCheckoutError('現在は注文受付時間外です')
      return
    }

    if (cartItems.length === 0) {
      setCheckoutError('商品を1件以上カートに追加してください')
      return
    }

    if (!pickupNickname.trim()) {
      setCheckoutError('受け取りニックネームを入力してください')
      return
    }

    setSubmitting(true)
    setCheckoutError(null)

    try {
      const lineUserIdFromQuery = searchParams.get('line_user_id')?.trim() ?? ''
      const lineDisplayNameFromQuery = searchParams.get('line_display_name')?.trim() ?? ''
      const storedLiffContext = getStoredLiffOrderContext()
      const lineUserId = lineUserIdFromQuery || storedLiffContext.lineUserId
      const lineDisplayName = lineDisplayNameFromQuery || storedLiffContext.lineDisplayName
      const response = await fetchApi<PublicMobileOrderCheckoutResponse>('/api/public/mobile-order/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          public_token: pageData.orderPage.public_token,
          pickup_nickname: pickupNickname.trim(),
          customer_line_user_id: lineUserId || null,
          customer_line_display_name: lineDisplayName || null,
          items: cartItems.map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            selected_option_choice_ids: item.selected_options.flatMap((group) =>
              group.choices.map((choice) => choice.choice_id)
            ),
          })),
        }),
      })
      window.location.assign(response.checkout_url)
    } catch (error) {
      setCheckoutError(error instanceof ApiClientError ? error.message : '注文の送信に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }, [cartItems, pageData.activeSchedule, pageData.orderPage.public_token, pickupNickname, searchParams])

  const handleOpenPaymentConfirm = useCallback(() => {
    if (!pageData.activeSchedule) {
      setCheckoutError('現在は注文受付時間外です')
      return
    }

    if (cartItems.length === 0) {
      setCheckoutError('商品を1件以上カートに追加してください')
      return
    }

    if (!pickupNickname.trim()) {
      setCheckoutError('受け取りニックネームを入力してください')
      return
    }

    setCheckoutError(null)
    setShowPaymentConfirmModal(true)
  }, [cartItems.length, pageData.activeSchedule, pickupNickname])

  const handleConfirmPaymentSubmit = useCallback(async () => {
    setShowPaymentConfirmModal(false)
    await handleSubmitOrder()
  }, [handleSubmitOrder])

  return {
    checkoutError,
    setCheckoutError,
    submitting,
    completedOrder,
    isVerifyingPayment,
    showPaymentConfirmModal,
    setShowPaymentConfirmModal,
    transitioningStep,
    currentStep,
    replaceStep,
    resetToOrderPage,
    handleStartReview,
    handleGoToCart,
    handleOpenPaymentConfirm,
    handleConfirmPaymentSubmit,
  }
}
