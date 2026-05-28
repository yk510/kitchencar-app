'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ApiClientError, fetchApi } from '@/lib/api-client'
import LoadingLine from '@/components/LoadingLine'
import StorePosBottomBar from '@/components/store-pos/StorePosBottomBar'
import StorePosCartPanel from '@/components/store-pos/StorePosCartPanel'
import StorePosConfirmView from '@/components/store-pos/StorePosConfirmView'
import StorePosProductCustomizer from '@/components/store-pos/StorePosProductCustomizer'
import StorePosProductGrid from '@/components/store-pos/StorePosProductGrid'
import StorePosSubmittedView from '@/components/store-pos/StorePosSubmittedView'
import { applyInventorySnapshotToPayload } from '@/lib/public-mobile-order-data'
import {
  buildPublicOrderStepUrl,
  buildResolvedSelectionState,
  resolveSelectedProduct,
} from '@/lib/public-order-flow'
import {
  formatPublicOrderCartSummary,
} from '@/lib/public-order-display'
import {
  buildDefaultStorePosPaymentMethods,
  getDefaultStorePosProductFilter,
  getInitialStorePosSelectedProduct,
  inferStorePosProductCategory,
  isStorePosRecommendedProduct,
  type ProductFilterKey,
  type StorePosCreateResponse,
  type SubmittedStorePosOrder,
} from '@/lib/store-pos-ui'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import { usePublicOrderCart } from '@/lib/use-public-order-cart'
import { useStorePosSettlement } from '@/lib/use-store-pos-settlement'
import type {
  PublicMobileOrderInventorySnapshot,
  PublicMobileOrderPagePayload,
  PublicMobileOrderProduct,
  StorePosCreatePayload,
  StorePosPaymentMethod,
} from '@/types/api-payloads'

export default function StorePosPageClient({ data }: { data: PublicMobileOrderPagePayload }) {
  const [pageData, setPageData] = useState<PublicMobileOrderPagePayload>(data)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<StorePosPaymentMethod>('cash')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submittedOrder, setSubmittedOrder] = useState<SubmittedStorePosOrder | null>(null)
  const [confirmingPage, setConfirmingPage] = useState(false)
  const [resettingToMenu, setResettingToMenu] = useState(false)
  const [inventoryRefreshing, setInventoryRefreshing] = useState(!data.inventoryHydrated)
  const [activeFilter, setActiveFilter] = useState<ProductFilterKey>(() => getDefaultStorePosProductFilter(data.products))
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
  const isConfirmStep = searchParams.get('step') === 'confirm'

  const paymentMethods = useMemo(() => buildDefaultStorePosPaymentMethods(pageData.store), [pageData.store])
  const cartTotal = useMemo(() => cartItems.reduce((sum, item) => sum + item.line_total, 0), [cartItems])
  const totalItems = useMemo(() => cartItems.reduce((sum, item) => sum + item.quantity, 0), [cartItems])
  const cartSummary = useMemo(() => formatPublicOrderCartSummary(cartItems), [cartItems])
  const categorizedProducts = useMemo(
    () =>
      pageData.products.map((product, index) => ({
        product,
        category: inferStorePosProductCategory(product),
        recommended: isStorePosRecommendedProduct(product, index),
      })),
    [pageData.products]
  )
  const filteredProducts = useMemo(() => {
    if (activeFilter === 'all') return categorizedProducts.map((entry) => entry.product)
    if (activeFilter === 'recommended') {
      return categorizedProducts.filter((entry) => entry.recommended).map((entry) => entry.product)
    }
    return categorizedProducts.filter((entry) => entry.category === activeFilter).map((entry) => entry.product)
  }, [activeFilter, categorizedProducts])
  const selectedProductIsRecommended = useMemo(
    () => categorizedProducts.some((entry) => entry.product.id === selectedProduct?.id && entry.recommended),
    [categorizedProducts, selectedProduct?.id]
  )
  const {
    countdownSeconds,
    waitingSettlement,
    settlementMessage,
    isPrintingReceipt,
    isSettlementComplete,
    beginWaitingSettlement,
    resetSettlement,
  } = useStorePosSettlement({
    submittedOrder,
    setSubmittedOrder,
    cartItems,
    storeName: pageData.store.store_name,
    publicToken: pageData.orderPage.public_token,
    onResetForNextCustomer: handleResetForNextCustomer,
  })

  useEffect(() => {
    if (!paymentMethods.includes(selectedPaymentMethod)) {
      setSelectedPaymentMethod(paymentMethods[0] ?? 'cash')
    }
  }, [paymentMethods, selectedPaymentMethod])

  useEffect(() => {
    setPageData(data)
    setInventoryRefreshing(!data.inventoryHydrated)
  }, [data])

  useEffect(() => {
    if (!selectedProduct && pageData.products[0]) {
      const nextState = buildResolvedSelectionState(pageData.products, null)
      setSelectedProduct(nextState.product)
      setSelection(nextState.selection)
    }
  }, [pageData.products, selectedProduct])

  useEffect(() => {
    if (isConfirmStep) {
      setConfirmingPage(false)
    }
  }, [isConfirmStep])

  useEffect(() => {
    if (!selectedProduct) return
    if (filteredProducts.some((product) => product.id === selectedProduct.id)) return
    const nextState = buildResolvedSelectionState(pageData.products, selectedProduct.id, filteredProducts)
    setSelectedProduct(nextState.product)
    setSelection(nextState.selection)
  }, [pageData.products, filteredProducts, selectedProduct])

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
    enabled: !submittedOrder,
    intervalMs: 15000,
    run: async () => {
      await refreshInventory()
    },
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
      pageData.products.filter((product, index) => {
        if (defaultFilter === 'all') return true
        if (defaultFilter === 'recommended') {
          return isStorePosRecommendedProduct(product, index)
        }
        return inferStorePosProductCategory(product) === defaultFilter
      })
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

  function handleClearCart() {
    clearCart()
    setSubmitError(null)

    if (isConfirmStep) {
      router.replace(pathname, { scroll: true })
    }
  }

  function handleBackToPreviousPage() {
    if (typeof window === 'undefined') return
    if (window.history.length > 1) {
      window.history.back()
      return
    }
    window.location.href = '/vendor/mobile-order'
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
      beginWaitingSettlement()
    } catch (error) {
      setSubmitError(error instanceof ApiClientError ? error.message : '注文の作成に失敗しました')
    } finally {
      setSubmitting(false)
    }
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
