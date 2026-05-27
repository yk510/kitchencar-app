'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ApiClientError, fetchApi } from '@/lib/api-client'
import LoadingLine from '@/components/LoadingLine'
import StorePosConfirmView from '@/components/store-pos/StorePosConfirmView'
import StorePosSubmittedView from '@/components/store-pos/StorePosSubmittedView'
import { applyInventorySnapshotToPayload } from '@/lib/public-mobile-order-data'
import {
  buildInitialProductSelection,
  buildPublicOrderCartItemCore,
  getPublicOrderCartLineTotal,
  getPublicOrderChoicePriceLabel,
  getPublicOrderInventoryBadge,
  isPublicOrderProductUnavailable,
  type PublicOrderProductSelection,
  validatePublicOrderSelection,
} from '@/lib/public-order-cart'
import {
  buildPublicOrderStepUrl,
  buildResolvedSelectionState,
  resolveSelectedProduct,
} from '@/lib/public-order-flow'
import {
  formatPublicOrderCartSummary,
  formatPublicOrderPrice,
} from '@/lib/public-order-display'
import {
  addNativeReceiptPrintCallbackListener,
  buildNativeReceiptPrintRequest,
  dispatchNativeReceiptPrint,
} from '@/lib/receipt-printing/native-print-bridge'
import { buildStorePosReceiptPrintPayload } from '@/lib/receipt-printing/store-pos-payload'
import {
  buildDefaultStorePosPaymentMethods,
  buildStorePosReceiptPrintFailureMessage,
  getDefaultStorePosProductFilter,
  getInitialStorePosSelectedProduct,
  getStorePosCategoryLabel,
  getStorePosUnavailableMessage,
  inferStorePosProductCategory,
  isStorePosRecommendedProduct,
  primaryButtonClassName,
  secondaryButtonClassName,
  type ProductFilterKey,
  type StorePosCartItem,
  type StorePosCreateResponse,
  type SubmittedStorePosOrder,
} from '@/lib/store-pos-ui'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import type {
  NativeReceiptBridgeCallbackPayload,
  PublicMobileOrderInventorySnapshot,
  PublicMobileOrderPagePayload,
  PublicMobileOrderProduct,
  PublicStorePosOrderStatusResponse,
  StorePosCreatePayload,
  StorePosPaymentMethod,
} from '@/types/api-payloads'

export default function StorePosPageClient({ data }: { data: PublicMobileOrderPagePayload }) {
  const [pageData, setPageData] = useState<PublicMobileOrderPagePayload>(data)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [cartItems, setCartItems] = useState<StorePosCartItem[]>([])
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<StorePosPaymentMethod>('cash')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submittedOrder, setSubmittedOrder] = useState<SubmittedStorePosOrder | null>(null)
  const [confirmingPage, setConfirmingPage] = useState(false)
  const [resettingToMenu, setResettingToMenu] = useState(false)
  const [countdownSeconds, setCountdownSeconds] = useState(10)
  const [waitingSettlement, setWaitingSettlement] = useState(false)
  const [settlementMessage, setSettlementMessage] = useState<string | null>(null)
  const [isPrintingReceipt, setIsPrintingReceipt] = useState(false)
  const [isSettlementComplete, setIsSettlementComplete] = useState(false)
  const [inventoryRefreshing, setInventoryRefreshing] = useState(!data.inventoryHydrated)
  const [activeFilter, setActiveFilter] = useState<ProductFilterKey>(() => getDefaultStorePosProductFilter(data.products))
  const [selectedProduct, setSelectedProduct] = useState<PublicMobileOrderProduct | null>(() => {
    const defaultFilter = getDefaultStorePosProductFilter(data.products)
    return getInitialStorePosSelectedProduct(data.products, defaultFilter)
  })
  const [selection, setSelection] = useState<PublicOrderProductSelection | null>(() => {
    const defaultFilter = getDefaultStorePosProductFilter(pageData.products)
    const initialProduct = getInitialStorePosSelectedProduct(pageData.products, defaultFilter)
    return initialProduct ? buildInitialProductSelection(initialProduct) : null
  })
  const [selectionError, setSelectionError] = useState<string | null>(null)
  const isConfirmStep = searchParams.get('step') === 'confirm'
  const printedOrderIdsRef = useRef<Set<string>>(new Set())
  const pendingPrintOrderIdsRef = useRef<Set<string>>(new Set())
  const requestToOrderIdRef = useRef<Map<string, string>>(new Map())

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

  useEffect(() => {
    if (!submittedOrder) return
    if (submittedOrder.status !== 'cancelled' && !isSettlementComplete) return

    setCountdownSeconds(10)
    const intervalId = window.setInterval(() => {
      setCountdownSeconds((current) => {
        if (current <= 1) {
          window.clearInterval(intervalId)
          handleResetForNextCustomer()
          return 0
        }
        return current - 1
      })
    }, 1000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [isSettlementComplete, submittedOrder])

  useEffect(() => {
    if (!submittedOrder) return
    if (submittedOrder.payment_status === 'paid' || submittedOrder.status === 'cancelled') return
    setWaitingSettlement(true)
  }, [submittedOrder])

  useEffect(() => {
    const removeListener = addNativeReceiptPrintCallbackListener((payload: NativeReceiptBridgeCallbackPayload) => {
      const orderId = requestToOrderIdRef.current.get(payload.request_id)
      if (!orderId) return
      if (!submittedOrder || submittedOrder.order_id !== orderId) return

      if (payload.status === 'accepted') {
        setIsPrintingReceipt(true)
        setSettlementMessage('レシート印刷を開始しています。印刷が終わるまでこのままお待ちください。')
        return
      }

      pendingPrintOrderIdsRef.current.delete(orderId)
      requestToOrderIdRef.current.delete(payload.request_id)
      setIsPrintingReceipt(false)

      if (payload.status === 'printed') {
        printedOrderIdsRef.current.add(orderId)
        setSettlementMessage('レシートを印刷しました。10秒後に次の注文画面へ戻ります。')
        setWaitingSettlement(false)
        setIsSettlementComplete(true)
        return
      }

      if (payload.status === 'failed') {
        setSettlementMessage(buildStorePosReceiptPrintFailureMessage(payload.error_message))
        setWaitingSettlement(false)
        setIsSettlementComplete(true)
        return
      }

      if (payload.status === 'unsupported') {
        setSettlementMessage(
          'お支払いは完了しましたが、この端末では自動印刷に対応していません。店員の方はPOS用iPadアプリで開いているか確認してください。必要に応じて注文管理画面から再印刷してください。10秒後に次の注文画面へ戻ります。'
        )
        setWaitingSettlement(false)
        setIsSettlementComplete(true)
      }
    })

    return removeListener
  }, [submittedOrder])

  useLiveRefresh({
    enabled:
      !!submittedOrder &&
      submittedOrder.payment_status !== 'paid' &&
      submittedOrder.status !== 'cancelled',
    intervalMs: 2000,
    minGapMs: 900,
    run: async () => {
      if (!submittedOrder) return

      try {
        const response = await fetchApi<PublicStorePosOrderStatusResponse>(
          `/api/public/store-pos/orders/${submittedOrder.order_id}?public_token=${encodeURIComponent(pageData.orderPage.public_token)}`,
          {
            cache: 'no-store',
          }
        )

        setSubmittedOrder((current) =>
          current
            ? {
                ...current,
                payment_status: response.payment_status as SubmittedStorePosOrder['payment_status'],
                status: response.status as SubmittedStorePosOrder['status'],
                paid_at: response.paid_at,
                cancelled_at: response.cancelled_at,
              }
            : current
        )

        if (response.status === 'cancelled') {
          setSettlementMessage('店員が注文をキャンセルしました。10秒後に次の注文画面へ戻ります。')
          setWaitingSettlement(false)
          setIsPrintingReceipt(false)
          setIsSettlementComplete(true)
          return
        }

        if (response.payment_status === 'paid') {
          setSettlementMessage('店員が料金受領を記録しました。レシート印刷を確認しています。')
          setWaitingSettlement(false)
        }
      } catch {
        // Keep polling; temporary fetch failure should not break the kiosk flow.
      }
    },
  })

  function selectProduct(product: PublicMobileOrderProduct) {
    setSelectedProduct(product)
    setSelection(buildInitialProductSelection(product))
    setSelectionError(null)
  }

  function toggleChoice(group: PublicMobileOrderProduct['option_groups'][number], choiceId: string) {
    if (!selection) return

    setSelection((current) => {
      if (!current) return current
      const selectedIds = current.selectedChoiceIdsByGroup[group.id] ?? []
      const isSelected = selectedIds.includes(choiceId)
      let nextSelectedIds: string[]

      if (group.selection_type === 'single') {
        nextSelectedIds = isSelected ? [] : [choiceId]
      } else {
        nextSelectedIds = isSelected
          ? selectedIds.filter((id) => id !== choiceId)
          : [...selectedIds, choiceId]
      }

      return {
        ...current,
        selectedChoiceIdsByGroup: {
          ...current.selectedChoiceIdsByGroup,
          [group.id]: nextSelectedIds,
        },
      }
    })
    setSelectionError(null)
  }

  function updateQuantity(nextQuantity: number) {
    setSelection((current) => (current ? { ...current, quantity: Math.max(1, nextQuantity) } : current))
    setSelectionError(null)
  }

  function handleAddSelectedProduct() {
    if (!selectedProduct || !selection) return

    const validationError = validatePublicOrderSelection(selectedProduct, selection)
    if (validationError) {
      setSelectionError(validationError)
      return
    }

    setCartItems((current) => [
      ...current,
      {
        id: `${selectedProduct.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        ...buildPublicOrderCartItemCore(selectedProduct, selection),
      },
    ])
    setSelection(buildInitialProductSelection(selectedProduct))
    setSelectionError(null)
    setSubmitError(null)
  }

  function updateCartQuantity(itemId: string, nextQuantity: number) {
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
    setCountdownSeconds(10)
    setWaitingSettlement(false)
    setSettlementMessage(null)
    setIsPrintingReceipt(false)
    setIsSettlementComplete(false)
    setActiveFilter(defaultFilter)
    setSelectedProduct(nextState.product)
    setSelection(nextState.selection)
    setSelectionError(null)
    setResettingToMenu(false)
  }

  function handleClearCart() {
    setCartItems([])
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
      setWaitingSettlement(true)
      setIsPrintingReceipt(false)
      setIsSettlementComplete(false)
      setSettlementMessage('店員が会計確認を行っています。料金受領またはキャンセル後に自動で次の注文へ進みます。')
    } catch (error) {
      setSubmitError(error instanceof ApiClientError ? error.message : '注文の作成に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  async function dispatchCustomerReceiptPrint(order: SubmittedStorePosOrder) {
    if (printedOrderIdsRef.current.has(order.order_id)) {
      return
    }

    if (pendingPrintOrderIdsRef.current.has(order.order_id)) {
      return
    }

    const payload = buildStorePosReceiptPrintPayload({
      storeName: pageData.store.store_name,
      orderId: order.order_id,
      orderNumber: order.order_number,
      orderedAt: order.ordered_at,
      totalAmount: order.total_amount,
      items: cartItems.map(
        (item) => ({
          order_item_id: item.id,
          product_name: item.product_name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          line_total_amount: item.line_total,
          options: item.selected_options.flatMap((group) =>
            group.choices.map((choice) => ({
              option_group_name: group.group_name,
              option_choice_name: choice.choice_name,
              price_delta: choice.price_delta,
            }))
          ),
        })
      ),
    })

    const request = buildNativeReceiptPrintRequest({
      payload,
      mode: 'ios_webview_wrapper',
      intent: 'auto_print',
      origin: 'store_pos',
    })

    pendingPrintOrderIdsRef.current.add(order.order_id)
    requestToOrderIdRef.current.set(request.request_id, order.order_id)
    const dispatchResult = dispatchNativeReceiptPrint(request)

    if (!dispatchResult.dispatched) {
      pendingPrintOrderIdsRef.current.delete(order.order_id)
      requestToOrderIdRef.current.delete(request.request_id)
      setIsPrintingReceipt(false)
      setSettlementMessage(
        'お支払いは完了しましたが、この画面では自動でレシート印刷できません。店員の方はPOS用iPadアプリで開いているか確認してください。必要に応じて注文管理画面から再印刷してください。10秒後に次の注文画面へ戻ります。'
      )
      setIsSettlementComplete(true)
      return
    }

    setIsPrintingReceipt(true)
    setSettlementMessage('レシート印刷を開始しています。印刷が終わるまでこのままお待ちください。')
  }

  useEffect(() => {
    if (!submittedOrder) return
    if (submittedOrder.status === 'cancelled') return
    if (submittedOrder.payment_status !== 'paid') return
    if (printedOrderIdsRef.current.has(submittedOrder.order_id)) return
    if (pendingPrintOrderIdsRef.current.has(submittedOrder.order_id)) return
    if (isSettlementComplete) return
    void dispatchCustomerReceiptPrint(submittedOrder)
  }, [cartItems, isSettlementComplete, pageData.store.store_name, submittedOrder])

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
          <div className="rounded-[36px] border border-[var(--line-soft)] bg-white px-6 py-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-[var(--text-main)]">商品を選ぶ</h2>
                <p className="mt-1 text-sm text-[var(--text-sub)]">おすすめやカテゴリから商品を選び、右側で数量やトッピングを決められます。</p>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
                {inventoryRefreshing ? '在庫確認中...' : `${filteredProducts.length} / ${pageData.products.length} 商品`}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {(['recommended', 'all', 'main', 'side', 'drink', 'other'] as ProductFilterKey[]).map((filterKey) => {
                const active = activeFilter === filterKey
                return (
                  <button
                    key={filterKey}
                    type="button"
                    onClick={() => setActiveFilter(filterKey)}
                    className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                      active
                        ? 'bg-[var(--accent-blue)] text-white shadow-[0_10px_24px_rgba(37,99,235,0.24)]'
                        : 'bg-white text-slate-600 ring-1 ring-[var(--line-soft)] hover:bg-slate-50'
                    }`}
                  >
                    {getStorePosCategoryLabel(filterKey)}
                  </button>
                )
              })}
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {filteredProducts.map((product) => {
                const inventoryBadge = getPublicOrderInventoryBadge(product)
                const active = selectedProduct?.id === product.id
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => selectProduct(product)}
                    className={`flex h-full flex-col rounded-[30px] border px-5 py-5 text-left shadow-[0_10px_28px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 ${
                      active
                        ? 'border-[var(--accent-blue)] bg-[var(--accent-blue-soft)]'
                        : 'border-[var(--line-soft)] bg-[#fcfdff] hover:bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="mb-4 flex h-44 items-center justify-center overflow-hidden rounded-[24px] border border-[var(--line-soft)] bg-[#f8fbff] p-4">
                          {product.image_url ? (
                            <div className="grid h-full w-full place-items-center overflow-hidden rounded-[18px] bg-white">
                              <img
                                src={product.image_url}
                                alt={product.name}
                                className="max-h-full max-w-full object-contain object-center"
                              />
                            </div>
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-400">
                              商品画像を準備中です
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 rounded-full bg-[var(--accent-blue)]/10 px-3 py-1 text-sm font-semibold text-[var(--accent-blue)]">
                        {formatPublicOrderPrice(product.price)}
                      </div>
                    </div>

                    <div className="min-h-[5.25rem]">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="line-clamp-2 min-h-[3.75rem] text-xl font-black leading-[1.85rem] text-[var(--text-main)]">
                          {product.name}
                        </h3>
                        {categorizedProducts.find((entry) => entry.product.id === product.id)?.recommended && (
                          <span className="rounded-full bg-yellow-100 px-3 py-1 text-[11px] font-semibold text-yellow-800">
                            おすすめ
                          </span>
                        )}
                        {inventoryBadge && (
                          <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${inventoryBadge.className}`}>
                            {inventoryBadge.label}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="min-h-[5.5rem]">
                      {product.description ? (
                        <p className="line-clamp-3 text-sm leading-6 text-[var(--text-sub)]">{product.description}</p>
                      ) : (
                        <p className="line-clamp-3 text-sm leading-6 text-[var(--text-sub)]">店頭POSの簡易注文です</p>
                      )}
                    </div>

                    <div className="mt-auto flex items-center justify-between gap-3 pt-4 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-[var(--line-soft)]">
                          {getStorePosCategoryLabel(inferStorePosProductCategory(product))}
                        </span>
                        <span className="text-[var(--text-sub)]">
                          {product.option_groups.length > 0 ? `${product.option_groups.length}個のオプション` : 'オプションなし'}
                        </span>
                      </div>
                      <span className="font-semibold text-[var(--accent-blue)]">{active ? '選択中' : '詳細を見る'}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="space-y-6">
            <section className="rounded-[36px] border border-[var(--line-soft)] bg-white px-6 py-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
              <h2 className="text-2xl font-black text-[var(--text-main)]">オプションと数量</h2>
              <p className="mt-1 text-sm text-[var(--text-sub)]">右側で内容を確認してからカートに追加します。</p>

              <div className="mt-5">
                {!selectedProduct || !selection ? (
                  <div className="rounded-[28px] border border-dashed border-[var(--line-soft)] bg-[#fbfdff] px-5 py-8 text-center text-sm text-[var(--text-sub)]">
                    左側の商品をタップしてください。
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-[28px] bg-[#fbfdff] px-5 py-5 ring-1 ring-[var(--line-soft)]">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="mb-4 flex h-52 items-center justify-center overflow-hidden rounded-[24px] border border-[var(--line-soft)] bg-white p-4">
                            {selectedProduct.image_url ? (
                              <div className="grid h-full w-full place-items-center overflow-hidden rounded-[18px] bg-[#f8fbff]">
                                <img
                                  src={selectedProduct.image_url}
                                  alt={selectedProduct.name}
                                  className="max-h-full max-w-full object-contain object-center"
                                />
                              </div>
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-400">
                                商品画像を準備中です
                              </div>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-xl font-black text-[var(--text-main)]">{selectedProduct.name}</h3>
                            {categorizedProducts.find((entry) => entry.product.id === selectedProduct.id)?.recommended && (
                              <span className="rounded-full bg-yellow-100 px-3 py-1 text-[11px] font-semibold text-yellow-800">
                                おすすめ
                              </span>
                            )}
                            {getPublicOrderInventoryBadge(selectedProduct) && (
                              <span
                                className={`rounded-full px-3 py-1 text-[11px] font-semibold ${getPublicOrderInventoryBadge(selectedProduct)?.className}`}
                              >
                                {getPublicOrderInventoryBadge(selectedProduct)?.label}
                              </span>
                            )}
                          </div>
                          <p className="mt-2 text-sm leading-6 text-[var(--text-sub)]">{selectedProduct.description || '商品の説明は準備中です。'}</p>
                        </div>
                        <div className="rounded-full bg-[var(--accent-blue)]/10 px-3 py-1 text-sm font-semibold text-[var(--accent-blue)]">
                          {formatPublicOrderPrice(selectedProduct.price)}
                        </div>
                      </div>
                    </div>

                    {isPublicOrderProductUnavailable(selectedProduct) && (
                      <div className="rounded-[24px] bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                        {getStorePosUnavailableMessage(selectedProduct)}
                      </div>
                    )}

                    {selectedProduct.option_groups.length === 0 ? (
                      <div className="rounded-[28px] border border-dashed border-[var(--line-soft)] bg-[#fbfdff] px-5 py-5 text-sm text-[var(--text-sub)]">
                        この商品にはオプションがありません。
                      </div>
                    ) : (
                      selectedProduct.option_groups.map((group) => {
                        const selectedIds = selection.selectedChoiceIdsByGroup[group.id] ?? []
                        return (
                          <div key={group.id} className="rounded-[28px] bg-[#fbfdff] px-5 py-5 ring-1 ring-[var(--line-soft)]">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-base font-bold text-[var(--text-main)]">{group.name}</h4>
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                                {group.selection_type === 'single' ? '単一選択' : '複数選択'}
                              </span>
                              {group.is_required && (
                                <span className="rounded-full bg-rose-100 px-2.5 py-1 text-[11px] font-semibold text-rose-700">
                                  必須
                                </span>
                              )}
                            </div>

                            <div className="mt-3 space-y-2">
                              {group.choices.map((choice) => {
                                const selected = selectedIds.includes(choice.id)
                                return (
                                  <button
                                    key={choice.id}
                                    type="button"
                                    disabled={!choice.is_active}
                                    onClick={() => toggleChoice(group, choice.id)}
                                    className={`flex w-full items-center justify-between rounded-[22px] px-4 py-3 text-left text-sm transition ${
                                      selected
                                        ? 'bg-[var(--accent-blue-soft)] text-[var(--accent-blue)] ring-1 ring-[var(--accent-blue)]'
                                        : 'bg-white text-slate-700 ring-1 ring-[var(--line-soft)] hover:bg-slate-50'
                                    } disabled:cursor-not-allowed disabled:opacity-50`}
                                  >
                                    <span className={choice.is_active ? '' : 'line-through'}>{choice.name}</span>
                                    <span className="font-medium">{getPublicOrderChoicePriceLabel(choice)}</span>
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })
                    )}

                    <div className="rounded-[28px] bg-[#fbfdff] px-5 py-5 ring-1 ring-[var(--line-soft)]">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-sm font-semibold text-gray-500">数量</span>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => updateQuantity(selection.quantity - 1)}
                            className={secondaryButtonClassName}
                          >
                            −
                          </button>
                          <div className="min-w-[72px] rounded-[20px] bg-white px-4 py-3 text-center text-lg font-black text-[var(--text-main)] ring-1 ring-[var(--line-soft)]">
                            {selection.quantity}
                          </div>
                          <button
                            type="button"
                            onClick={() => updateQuantity(selection.quantity + 1)}
                            className={secondaryButtonClassName}
                          >
                            ＋
                          </button>
                        </div>
                      </div>
                    </div>

                    {selectionError && (
                      <div className="rounded-[24px] bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                        {selectionError}
                      </div>
                    )}

                    <div className="rounded-[28px] bg-[#f8fbff] px-5 py-5 ring-1 ring-[var(--line-soft)]">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-gray-500">この商品の合計</p>
                          <p className="mt-2 text-2xl font-black text-[var(--text-main)]">
                            {formatPublicOrderPrice(getPublicOrderCartLineTotal(selectedProduct, selection))}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleAddSelectedProduct}
                          disabled={isPublicOrderProductUnavailable(selectedProduct)}
                          className={primaryButtonClassName}
                        >
                          {isPublicOrderProductUnavailable(selectedProduct) ? '売り切れ中です' : 'カートに追加'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-[36px] border border-[var(--line-soft)] bg-white px-6 py-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-black text-[var(--text-main)]">カート</h2>
                  <p className="mt-1 text-sm text-[var(--text-sub)]">間違いがないか確認して、そのまま会計へ進めます。</p>
                </div>
                <button
                  type="button"
                  onClick={handleClearCart}
                  disabled={cartItems.length === 0}
                  className="inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-600 ring-1 ring-[var(--line-soft)] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  カートを空にする
                </button>
              </div>

              <div className="mt-5 space-y-3">
                {cartItems.length === 0 ? (
                  <div className="rounded-[28px] border border-dashed border-[var(--line-soft)] bg-[#fbfdff] px-5 py-8 text-center text-sm text-[var(--text-sub)]">
                    まだ商品が入っていません。左側の商品を選んで追加してください。
                  </div>
                ) : (
                  cartItems.map((item) => (
                    <div key={item.id} className="rounded-[28px] bg-[#fbfdff] px-5 py-4 ring-1 ring-[var(--line-soft)]">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-bold text-[var(--text-main)]">{item.product_name}</p>
                          <p className="mt-1 text-sm text-[var(--text-sub)]">{formatPublicOrderPrice(item.unit_price)} / 1点</p>
                          {item.selected_options.length > 0 && (
                            <div className="mt-2 space-y-1 text-xs text-[var(--text-sub)]">
                              {item.selected_options.map((group) => (
                                <p key={`${item.id}-${group.group_id}`}>
                                  {group.group_name}: {group.choices.map((choice) => choice.choice_name).join(' / ')}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                        <p className="text-lg font-black text-[var(--accent-blue)]">{formatPublicOrderPrice(item.line_total)}</p>
                      </div>
                      <div className="mt-4 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(item.id, item.quantity - 1)}
                          className={secondaryButtonClassName}
                        >
                          −
                        </button>
                        <div className="min-w-[72px] rounded-[20px] bg-white px-4 py-3 text-center text-lg font-black text-[var(--text-main)] ring-1 ring-[var(--line-soft)]">
                          {item.quantity}
                        </div>
                        <button
                          type="button"
                          onClick={() => updateCartQuantity(item.id, item.quantity + 1)}
                          className={secondaryButtonClassName}
                        >
                          ＋
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-[36px] border border-[var(--line-soft)] bg-white px-6 py-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
              <h2 className="text-2xl font-black text-[var(--text-main)]">ご注文の最終確認へ</h2>
              <p className="mt-2 text-sm leading-7 text-[var(--text-sub)]">
                ここでは商品だけを選びます。お支払い方法の選択と最終確認は、次の確認ページで行います。
              </p>

              {submitError && (
                <div className="mt-5 rounded-[24px] bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {submitError}
                </div>
              )}

              {confirmingPage ? (
                <div className="mt-5 rounded-[24px] bg-[var(--accent-blue-soft)] px-4 py-4">
                  <LoadingLine label="確認ページへ移動しています。少々お待ちください。" />
                </div>
              ) : null}

              <div className="mt-6 rounded-[28px] bg-[#f8fbff] px-5 py-5 ring-1 ring-[var(--line-soft)]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-500">お支払い合計</p>
                    <p className="mt-2 text-4xl font-black text-[var(--text-main)]">{formatPublicOrderPrice(cartTotal)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={openConfirmPage}
                    disabled={cartItems.length === 0 || confirmingPage}
                    className={primaryButtonClassName}
                  >
                    {confirmingPage ? '確認ページを開いています...' : '注文を確認する'}
                  </button>
                </div>
              </div>
            </section>
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

        <section className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-4 md:px-6">
          <div className="pointer-events-auto mx-auto max-w-7xl rounded-[28px] border border-[var(--line-soft)] bg-white/95 px-4 py-4 shadow-[0_-12px_40px_rgba(15,23,42,0.12)] backdrop-blur md:px-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">注文内容の確認</p>
                <p className="mt-1 truncate text-sm font-medium text-slate-500">{cartSummary}</p>
                <div className="mt-2 flex flex-wrap items-center gap-4">
                  <p className="text-lg font-black text-[var(--text-main)]">{formatPublicOrderPrice(cartTotal)}</p>
                  <p className="text-sm font-semibold text-slate-500">{totalItems} 点</p>
                  <p className="text-sm font-semibold text-slate-500">お支払い方法は次の確認ページで選択します</p>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handleClearCart}
                  disabled={cartItems.length === 0 || confirmingPage}
                  className="inline-flex items-center justify-center rounded-[24px] bg-white px-5 py-4 text-base font-semibold text-slate-600 ring-1 ring-[var(--line-soft)] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  カートを空にする
                </button>
                <button
                  type="button"
                  onClick={openConfirmPage}
                  disabled={cartItems.length === 0 || confirmingPage}
                  className="inline-flex min-w-[220px] items-center justify-center rounded-[24px] bg-[var(--accent-blue)] px-6 py-4 text-lg font-bold text-white shadow-[0_18px_40px_rgba(37,99,235,0.3)] transition hover:brightness-[1.03] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {confirmingPage ? '確認ページを開いています...' : '注文を確認する'}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

    </div>
  )
}
