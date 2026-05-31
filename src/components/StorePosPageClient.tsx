'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import LoadingLine from '@/components/LoadingLine'
import StorePosBottomBar from '@/components/store-pos/StorePosBottomBar'
import StorePosCartPanel from '@/components/store-pos/StorePosCartPanel'
import StorePosConfirmView from '@/components/store-pos/StorePosConfirmView'
import StorePosProductCustomizer from '@/components/store-pos/StorePosProductCustomizer'
import StorePosProductGrid from '@/components/store-pos/StorePosProductGrid'
import StorePosSubmittedView from '@/components/store-pos/StorePosSubmittedView'
import { buildResolvedSelectionState } from '@/lib/public-order-flow'
import {
  formatPublicOrderCartSummary,
} from '@/lib/public-order-display'
import {
  getDefaultStorePosProductFilter,
  getInitialStorePosSelectedProduct,
  type SubmittedStorePosOrder,
} from '@/lib/store-pos-ui'
import { usePublicOrderInventoryRefresh } from '@/lib/use-public-order-inventory-refresh'
import { usePublicOrderCart } from '@/lib/use-public-order-cart'
import { usePublicOrderProductSelectionSync } from '@/lib/use-public-order-product-selection-sync'
import { useStorePosOrderFlow } from '@/lib/use-store-pos-order-flow'
import { useStorePosProductFilters } from '@/lib/use-store-pos-product-filters'
import { useStorePosSettlement } from '@/lib/use-store-pos-settlement'
import type {
  PublicMobileOrderPagePayload,
} from '@/types/api-payloads'

export default function StorePosPageClient({ data }: { data: PublicMobileOrderPagePayload }) {
  const pathname = usePathname()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submittedOrder, setSubmittedOrder] = useState<SubmittedStorePosOrder | null>(null)
  const [resettingToMenu, setResettingToMenu] = useState(false)
  const {
    pageData,
    inventoryRefreshing,
  } = usePublicOrderInventoryRefresh({
    data,
    enabled: !submittedOrder,
  })
  const defaultProductFilter = getDefaultStorePosProductFilter(data.products)
  const initialSelectedProduct = getInitialStorePosSelectedProduct(data.products, defaultProductFilter)
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
    updateCartQuantity,
    clearCart,
  } = usePublicOrderCart({
    initialSelectedProduct,
    getUnavailableMessage: () => 'この商品は現在売り切れのため、カートに追加できません。',
    onUnavailableProduct: (message) => setSubmitError(message),
  })

  const {
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
  } = useStorePosOrderFlow({
    pageData,
    cartItems,
    clearCart,
    setSubmitError,
    setSubmittedOrder,
  })

  const cartTotal = useMemo(() => cartItems.reduce((sum, item) => sum + item.line_total, 0), [cartItems])
  const totalItems = useMemo(() => cartItems.reduce((sum, item) => sum + item.quantity, 0), [cartItems])
  const cartSummary = useMemo(() => formatPublicOrderCartSummary(cartItems), [cartItems])
  const {
    activeFilter,
    setActiveFilter,
    categorizedProducts,
    filteredProducts,
    selectedProductIsRecommended,
    getProductsForFilter,
  } = useStorePosProductFilters({
    products: pageData.products,
    initialProducts: data.products,
    selectedProductId: selectedProduct?.id,
  })
  const {
    countdownSeconds,
    waitingSettlement,
    settlementMessage,
    isPrintingReceipt,
    isSettlementComplete,
    resetSettlement,
  } = useStorePosSettlement({
    submittedOrder,
    setSubmittedOrder,
    cartItems,
    storeName: pageData.store.store_name,
    publicToken: pageData.orderPage.public_token,
    onResetForNextCustomer: handleResetForNextCustomer,
  })

  usePublicOrderProductSelectionSync({
    products: pageData.products,
    selectedProduct,
    setSelectedProduct,
    setSelection,
    activePreferredProducts: filteredProducts,
  })

  function updateQuantity(nextQuantity: number) {
    updateSelectionQuantity(nextQuantity)
  }

  function handleAddSelectedProduct() {
    addSelectedProductToCart({ onSuccess: () => setSubmitError(null) })
  }

  function handleResetForNextCustomer() {
    setResettingToMenu(true)
    if (typeof window !== 'undefined') {
      window.location.replace(pathname)
      return
    }

    const defaultFilter = getDefaultStorePosProductFilter(pageData.products)
    const nextState = buildResolvedSelectionState(
      pageData.products,
      null,
      getProductsForFilter(defaultFilter)
    )
    setSubmittedOrder(null)
    setCartItems([])
    setSubmitError(null)
    setConfirmingPage(false)
    setSelectedPaymentMethod(paymentMethods[0] ?? 'cash')
    resetSettlement()
    setActiveFilter(defaultFilter)
    setSelectedProduct(nextState.product)
    setSelection(nextState.selection)
    setSelectionError(null)
    setResettingToMenu(false)
  }

  function handleBackToPreviousPage() {
    if (typeof window === 'undefined') return
    if (window.history.length > 1) {
      window.history.back()
      return
    }
    window.location.href = '/vendor/mobile-order'
  }

  if (submittedOrder) {
    return (
      <StorePosSubmittedView
        submittedOrder={submittedOrder}
        cartItems={cartItems}
        totalItems={totalItems}
        countdownSeconds={countdownSeconds}
        settlementMessage={settlementMessage}
        isPrintingReceipt={isPrintingReceipt}
        isSettlementComplete={isSettlementComplete}
        waitingSettlement={waitingSettlement}
        resettingToMenu={resettingToMenu}
        onResetForNextCustomer={handleResetForNextCustomer}
      />
    )
  }

  if (isConfirmStep) {
    return (
      <StorePosConfirmView
        cartItems={cartItems}
        totalItems={totalItems}
        cartTotal={cartTotal}
        paymentMethods={paymentMethods}
        selectedPaymentMethod={selectedPaymentMethod}
        submitError={submitError}
        submitting={submitting}
        onPaymentMethodChange={setSelectedPaymentMethod}
        onReturnToProductSelection={returnToProductSelection}
        onSubmitOrder={handleSubmitOrder}
      />
    )
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef4ff_100%)] px-4 py-4 md:px-5 md:py-6">
      {confirmingPage ? (
        <div className="pointer-events-none fixed inset-x-0 top-0 z-50 px-4 pt-3 md:px-6">
          <div className="mx-auto max-w-7xl rounded-full bg-white/95 px-4 py-3 shadow-[0_12px_34px_rgba(15,23,42,0.12)] backdrop-blur">
            <LoadingLine label="確認ページを開いています..." />
          </div>
        </div>
      ) : null}
      <div className="mx-auto max-w-7xl space-y-5 pb-36">
        <section className="rounded-[36px] border border-[var(--line-soft)] bg-white px-6 py-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">
                Store POS
              </div>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-[var(--text-main)]">
                {pageData.store.store_name}
              </h1>
              <p className="mt-2 text-base leading-7 text-[var(--text-sub)]">
                商品を選んで、内容を確認したあと、お支払い方法を選んで注文を確定してください。お支払いは店員がご案内します。
              </p>
            </div>
            <div className="max-w-sm rounded-[24px] bg-[#f8fbff] px-5 py-4 ring-1 ring-[var(--line-soft)]">
              <p className="text-sm font-semibold text-gray-500">ご注文の進め方</p>
              <p className="mt-2 text-sm leading-6 text-[var(--text-sub)]">
                1. 商品を選ぶ  2. オプションと数量を決める  3. 注文内容を確認する  4. お支払い方法を選ぶ  5. 注文を確定する
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-[minmax(0,1.08fr)_minmax(320px,0.92fr)] xl:grid-cols-[1.2fr_0.8fr]">
          <StorePosProductGrid
            products={pageData.products}
            filteredProducts={filteredProducts}
            categorizedProducts={categorizedProducts}
            selectedProductId={selectedProduct?.id ?? null}
            activeFilter={activeFilter}
            inventoryRefreshing={inventoryRefreshing}
            onFilterChange={setActiveFilter}
            onSelectProduct={(product) => selectProduct(product, { allowUnavailable: true })}
          />

          <div className="space-y-6">
            <StorePosProductCustomizer
              selectedProduct={selectedProduct}
              selection={selection}
              isRecommended={selectedProductIsRecommended}
              selectionError={selectionError}
              onToggleChoice={toggleChoice}
              onUpdateQuantity={updateQuantity}
              onAddSelectedProduct={handleAddSelectedProduct}
            />

            <StorePosCartPanel
              cartItems={cartItems}
              cartTotal={cartTotal}
              submitError={submitError}
              confirmingPage={confirmingPage}
              onClearCart={handleClearCart}
              onUpdateCartQuantity={updateCartQuantity}
              onOpenConfirmPage={openConfirmPage}
            />
          </div>
        </section>

        <section className="rounded-[28px] border border-dashed border-[var(--line-soft)] bg-white/80 px-5 py-4">
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleBackToPreviousPage}
              className="inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-600 ring-1 ring-[var(--line-soft)] transition hover:bg-slate-50"
            >
              前の画面へ
            </button>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-600 ring-1 ring-[var(--line-soft)] transition hover:bg-slate-50"
            >
              ホームへ
            </Link>
          </div>
        </section>

        <StorePosBottomBar
          cartSummary={cartSummary}
          cartTotal={cartTotal}
          totalItems={totalItems}
          hasCartItems={cartItems.length > 0}
          confirmingPage={confirmingPage}
          onClearCart={handleClearCart}
          onOpenConfirmPage={openConfirmPage}
        />
      </div>

    </div>
  )
}
