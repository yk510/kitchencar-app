'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import PublicMobileOrderCartView from '@/components/public-mobile-order/PublicMobileOrderCartView'
import PublicMobileOrderCompleteView from '@/components/public-mobile-order/PublicMobileOrderCompleteView'
import PublicMobileOrderHeader from '@/components/public-mobile-order/PublicMobileOrderHeader'
import PublicMobileOrderMiniCart from '@/components/public-mobile-order/PublicMobileOrderMiniCart'
import PublicMobileOrderProductCustomizer from '@/components/public-mobile-order/PublicMobileOrderProductCustomizer'
import PublicMobileOrderProductList from '@/components/public-mobile-order/PublicMobileOrderProductList'
import PublicMobileOrderReviewView from '@/components/public-mobile-order/PublicMobileOrderReviewView'
import PublicMobileOrderVerifyingView from '@/components/public-mobile-order/PublicMobileOrderVerifyingView'
import { ApiClientError, fetchApi } from '@/lib/api-client'
import { applyInventorySnapshotToPayload } from '@/lib/public-mobile-order-data'
import { isPublicOrderProductUnavailable } from '@/lib/public-order-cart'
import {
  buildPublicOrderStepUrl,
  buildResolvedSelectionState,
  resolveSelectedProduct,
} from '@/lib/public-order-flow'
import {
  formatPublicMobileOrderDateTime,
  getPublicMobileOrderUnavailableMessage,
} from '@/lib/public-mobile-order-ui'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { usePublicOrderCart } from '@/lib/use-public-order-cart'
import type {
  PublicMobileOrderCheckoutResponse,
  PublicMobileOrderCheckoutStatusResponse,
  PublicMobileOrderInventorySnapshot,
  PublicMobileOrderPagePayload,
  PublicMobileOrderProduct,
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

export default function PublicMobileOrderPageClient({ data }: { data: PublicMobileOrderPagePayload }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pageData, setPageData] = useState<PublicMobileOrderPagePayload>(data)
  const [pickupNickname, setPickupNickname] = useState('')
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [completedOrder, setCompletedOrder] = useState<PublicMobileOrderCheckoutStatusResponse | null>(null)
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false)
  const [showPaymentConfirmModal, setShowPaymentConfirmModal] = useState(false)
  const [transitioningStep, setTransitioningStep] = useState<'cart' | 'review' | null>(null)
  const [inventoryRefreshing, setInventoryRefreshing] = useState(!data.inventoryHydrated)

  const stepParam = searchParams.get('step')
  const currentStep = stepParam === 'review' ? 'review' : stepParam === 'cart' ? 'cart' : 'menu'

  const availableProducts = useMemo(
    () => pageData.products.filter((product) => product.is_published && !isPublicOrderProductUnavailable(product)),
    [pageData.products]
  )
  const {
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
    removeCartItem,
  } = usePublicOrderCart({
    getUnavailableMessage: getPublicMobileOrderUnavailableMessage,
    onUnavailableProduct: (message) => setCheckoutError(message),
  })

  useEffect(() => {
    setPageData(data)
    setInventoryRefreshing(!data.inventoryHydrated)
  }, [data])

  async function refreshInventory() {
    try {
      const snapshot = await fetchApi<PublicMobileOrderInventorySnapshot>(
        `/api/public/mobile-order/${pageData.orderPage.public_token}/inventory`,
        { cache: 'no-store' }
      )
      setPageData((current) => applyInventorySnapshotToPayload(current, snapshot))
    } catch {
      // Keep current snapshot if inventory refresh fails.
    } finally {
      setInventoryRefreshing(false)
    }
  }

  useEffect(() => {
    if (pageData.inventoryHydrated) return
    setInventoryRefreshing(true)
    void refreshInventory()
  }, [pageData.inventoryHydrated])

  useLiveRefresh({
    enabled: true,
    intervalMs: 15000,
    run: async () => {
      await refreshInventory()
    },
  })

  useEffect(() => {
    if (!selectedProduct) return

    const nextSelected = resolveSelectedProduct(pageData.products, selectedProduct.id)
    if (!nextSelected) {
      setSelectedProduct(null)
      setSelection(null)
      return
    }

    setSelectedProduct(nextSelected)
  }, [pageData.products, selectedProduct])

  useEffect(() => {
    if (!selectedProduct && availableProducts[0]) {
      const nextState = buildResolvedSelectionState(pageData.products, null, availableProducts)
      setSelectedProduct(nextState.product)
      setSelection(nextState.selection)
    }
  }, [availableProducts, pageData.products, selectedProduct])

  function replaceStep(step: 'menu' | 'cart' | 'review') {
    const nextUrl = buildPublicOrderStepUrl(pathname, searchParams.toString(), step)
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', nextUrl)
    }
    router.replace(nextUrl, { scroll: false })
  }

  function resetToOrderPage() {
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
  }

  useEffect(() => {
    if ((currentStep === 'cart' || currentStep === 'review') && cartItems.length === 0) {
      replaceStep('menu')
    }
  }, [cartItems.length, currentStep])

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
          const next = await fetchApi<PublicMobileOrderInventorySnapshot>(
            `/api/public/mobile-order/${pageData.orderPage.public_token}/inventory`,
            { cache: 'no-store' }
          )
          if (!disposed) {
            setPageData((current) => applyInventorySnapshotToPayload(current, next))
          }
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
  }, [completedOrder, pageData.orderPage.public_token, searchParams])

  function handleSelectProduct(product: PublicMobileOrderProduct) {
    const selected = selectProduct(product)
    if (selected) {
      setCheckoutError(null)
    }
  }

  function updateQuantity(nextQuantity: number) {
    updateSelectionQuantity(nextQuantity)
  }

  function handleAddToCart() {
    addSelectedProductToCart({ onSuccess: () => setCheckoutError(null) })
  }

  function handleStartReview() {
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
  }

  function handleGoToCart() {
    if (cartItems.length === 0) {
      setCheckoutError('商品を1件以上カートに追加してください')
      return
    }

    setCheckoutError(null)
    setTransitioningStep('cart')
    replaceStep('cart')
  }

  async function handleSubmitOrder() {
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
  }

  function handleOpenPaymentConfirm() {
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
  }

  async function handleConfirmPaymentSubmit() {
    setShowPaymentConfirmModal(false)
    await handleSubmitOrder()
  }

  const cartTotal = useMemo(() => cartItems.reduce((sum, item) => sum + item.line_total, 0), [cartItems])

  if (completedOrder) {
    return <PublicMobileOrderCompleteView completedOrder={completedOrder} onResetToOrderPage={resetToOrderPage} />
  }

  if (isVerifyingPayment) {
    return <PublicMobileOrderVerifyingView />
  }

  if (currentStep === 'review') {
    return (
      <PublicMobileOrderReviewView
        cartItems={cartItems}
        pickupNickname={pickupNickname}
        cartTotal={cartTotal}
        checkoutError={checkoutError}
        submitting={submitting}
        transitioningStep={transitioningStep}
        showPaymentConfirmModal={showPaymentConfirmModal}
        onEditOrder={() => replaceStep('menu')}
        onOpenPaymentConfirm={handleOpenPaymentConfirm}
        onClosePaymentConfirm={() => setShowPaymentConfirmModal(false)}
        onConfirmPaymentSubmit={() => void handleConfirmPaymentSubmit()}
      />
    )
  }

  if (currentStep === 'cart') {
    return (
      <PublicMobileOrderCartView
        cartItems={cartItems}
        pickupNickname={pickupNickname}
        cartTotal={cartTotal}
        checkoutError={checkoutError}
        transitioningStep={transitioningStep}
        onPickupNicknameChange={setPickupNickname}
        onRemoveCartItem={removeCartItem}
        onBackToMenu={() => replaceStep('menu')}
        onStartReview={handleStartReview}
      />
    )
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 lg:px-6">
      <PublicMobileOrderHeader
        store={pageData.store}
        activeSchedule={pageData.activeSchedule}
        nextSchedule={pageData.nextSchedule}
      />

      {!pageData.activeSchedule ? (
        <section className="soft-panel rounded-[32px] p-6">
          <h2 className="text-xl font-bold text-[var(--text-main)]">ただいま受付時間外です</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--text-sub)]">
            {pageData.nextSchedule
              ? `次回は ${formatPublicMobileOrderDateTime(pageData.nextSchedule.opens_at)} から受付予定です。営業開始後に同じQRコードからご注文いただけます。`
              : '現在、次回受付予定は未設定です。最新情報は店頭やSNSでご確認ください。'}
          </p>
        </section>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
          <PublicMobileOrderProductList
            products={pageData.products}
            selectedProductId={selectedProduct?.id ?? null}
            inventoryRefreshing={inventoryRefreshing}
            onSelectProduct={handleSelectProduct}
          />

          <aside className="space-y-6">
            <PublicMobileOrderProductCustomizer
              selectedProduct={selectedProduct}
              selection={selection}
              selectionError={selectionError}
              onToggleChoice={toggleChoice}
              onUpdateQuantity={updateQuantity}
              onAddToCart={handleAddToCart}
            />

            <PublicMobileOrderMiniCart
              cartItems={cartItems}
              cartTotal={cartTotal}
              checkoutError={checkoutError}
              onGoToCart={handleGoToCart}
            />
          </aside>
        </div>
      )}
    </div>
  )
}
