'use client'

import { useMemo, useState } from 'react'
import PublicMobileOrderCartView from '@/components/public-mobile-order/PublicMobileOrderCartView'
import PublicMobileOrderCompleteView from '@/components/public-mobile-order/PublicMobileOrderCompleteView'
import PublicMobileOrderHeader from '@/components/public-mobile-order/PublicMobileOrderHeader'
import PublicMobileOrderMiniCart from '@/components/public-mobile-order/PublicMobileOrderMiniCart'
import PublicMobileOrderProductCustomizer from '@/components/public-mobile-order/PublicMobileOrderProductCustomizer'
import PublicMobileOrderProductList from '@/components/public-mobile-order/PublicMobileOrderProductList'
import PublicMobileOrderReviewView from '@/components/public-mobile-order/PublicMobileOrderReviewView'
import PublicMobileOrderVerifyingView from '@/components/public-mobile-order/PublicMobileOrderVerifyingView'
import { isPublicOrderProductUnavailable } from '@/lib/public-order-cart'
import {
  formatPublicMobileOrderDateTime,
  getPublicMobileOrderUnavailableMessage,
} from '@/lib/public-mobile-order-ui'
import { usePublicMobileOrderCheckout } from '@/lib/use-public-mobile-order-checkout'
import { usePublicOrderInventoryRefresh } from '@/lib/use-public-order-inventory-refresh'
import { usePublicOrderCart } from '@/lib/use-public-order-cart'
import { usePublicOrderProductSelectionSync } from '@/lib/use-public-order-product-selection-sync'
import type {
  PublicMobileOrderPagePayload,
  PublicMobileOrderProduct,
} from '@/types/api-payloads'

export default function PublicMobileOrderPageClient({ data }: { data: PublicMobileOrderPagePayload }) {
  const [pickupNickname, setPickupNickname] = useState('')
  const {
    pageData,
    inventoryRefreshing,
    refreshInventory,
  } = usePublicOrderInventoryRefresh({ data })

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

  const {
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
  } = usePublicMobileOrderCheckout({
    pageData,
    cartItems,
    pickupNickname,
    setCartItems,
    setPickupNickname,
    setSelectionError,
    onRefreshInventory: refreshInventory,
  })

  usePublicOrderProductSelectionSync({
    products: pageData.products,
    selectedProduct,
    setSelectedProduct,
    setSelection,
    initialPreferredProducts: availableProducts,
  })

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
