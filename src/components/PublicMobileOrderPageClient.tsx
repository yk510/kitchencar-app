'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import PublicMobileOrderCartView from '@/components/public-mobile-order/PublicMobileOrderCartView'
import PublicMobileOrderCompleteView from '@/components/public-mobile-order/PublicMobileOrderCompleteView'
import PublicMobileOrderReviewView from '@/components/public-mobile-order/PublicMobileOrderReviewView'
import PublicMobileOrderVerifyingView from '@/components/public-mobile-order/PublicMobileOrderVerifyingView'
import { ApiClientError, fetchApi } from '@/lib/api-client'
import { applyInventorySnapshotToPayload } from '@/lib/public-mobile-order-data'
import {
  getPublicOrderCartLineTotal,
  getPublicOrderChoicePriceLabel,
  getPublicOrderInventoryBadge,
  isPublicOrderProductUnavailable,
} from '@/lib/public-order-cart'
import {
  buildPublicOrderStepUrl,
  buildResolvedSelectionState,
  resolveSelectedProduct,
} from '@/lib/public-order-flow'
import { formatPublicOrderPrice } from '@/lib/public-order-display'
import {
  formatPublicMobileOrderDateTime,
  getPublicMobileOrderUnavailableMessage,
  publicOrderPrimaryCtaClassName,
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
      <section className="soft-panel rounded-[36px] px-6 py-7 lg:px-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge-soft badge-blue">MOBILE ORDER</span>
          <span
            className={`rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.12em] ${
              pageData.activeSchedule ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'
            }`}
          >
            {pageData.activeSchedule ? 'OPEN' : 'CLOSED'}
          </span>
        </div>

        <h1 className="mt-4 text-3xl font-black tracking-tight text-[var(--text-main)] lg:text-4xl">
          {pageData.store.store_name}
        </h1>

        <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-sub)]">
          {pageData.store.description || '店頭のQRコードから、モバイルオーダーで事前注文できます。'}
        </p>

        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-3xl border border-[var(--line-soft)] bg-white px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">受付状態</p>
            <p className={`mt-2 text-lg font-semibold ${pageData.activeSchedule ? 'text-emerald-700' : 'text-amber-700'}`}>
              {pageData.activeSchedule ? '受付中' : '受付時間外'}
            </p>
          </div>
          <div className="rounded-3xl border border-[var(--line-soft)] bg-white px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">現在の受付時間</p>
            <p className="mt-2 text-sm font-medium text-gray-700">
              {pageData.activeSchedule
                ? `${formatPublicMobileOrderDateTime(pageData.activeSchedule.opens_at)} - ${formatPublicMobileOrderDateTime(pageData.activeSchedule.closes_at)}`
                : '現在有効な営業枠はありません'}
            </p>
          </div>
          <div className="rounded-3xl border border-[var(--line-soft)] bg-white px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">次回受付予定</p>
            <p className="mt-2 text-sm font-medium text-gray-700">
              {pageData.nextSchedule ? formatPublicMobileOrderDateTime(pageData.nextSchedule.opens_at) : '未定'}
            </p>
          </div>
        </div>
      </section>

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
          <section className="space-y-4">
            {inventoryRefreshing ? (
              <div className="rounded-3xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-700">
                在庫を確認しています。売り切れや残りわずかの表示をまもなく更新します。
              </div>
            ) : null}
            {pageData.products.length === 0 ? (
              <div className="soft-panel rounded-[32px] p-6 text-sm text-gray-500">
                公開中の商品はまだありません。しばらくしてからもう一度ご確認ください。
              </div>
            ) : (
              pageData.products.map((product) => (
                (() => {
                  const inventoryBadge = getPublicOrderInventoryBadge(product)
                  const unavailable = isPublicOrderProductUnavailable(product)
                  const selected = selectedProduct?.id === product.id

                  return (
                <button
                  key={product.id}
                  type="button"
                  disabled={unavailable}
                  onClick={() => handleSelectProduct(product)}
                  aria-pressed={selected}
                  className={`soft-panel w-full rounded-[32px] p-5 text-left transition ${
                    selected
                      ? 'border-[var(--accent-blue)] bg-[var(--accent-blue-soft)]/40 ring-2 ring-[var(--accent-blue)] shadow-[0_18px_45px_rgba(37,99,235,0.18)]'
                      : unavailable
                        ? 'opacity-70'
                        : 'hover:translate-y-[-1px] hover:border-[var(--accent-blue-soft)] hover:shadow-md'
                  } disabled:cursor-not-allowed`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-3xl border bg-[#f8fafc] ${
                        selected ? 'border-[var(--accent-blue)]' : 'border-[var(--line-soft)]'
                      }`}
                    >
                      {product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-xs text-gray-400">画像なし</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold text-gray-800">{product.name}</h2>
                        {selected && (
                          <span className="rounded-full bg-[var(--accent-blue)] px-3 py-1 text-[11px] font-semibold text-white">
                            選択中
                          </span>
                        )}
                        {inventoryBadge && (
                          <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${inventoryBadge.className}`}>
                            {inventoryBadge.label}
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-sm leading-7 text-gray-500">
                        {product.description || '商品の説明は準備中です。'}
                      </p>
                      {selected && (
                        <p className="mt-3 text-sm font-semibold text-[var(--accent-blue)]">
                          右側でオプションと数量を調整できます
                        </p>
                      )}
                      <div className="mt-4 flex items-center justify-between gap-4">
                        <p className="text-base font-bold text-[var(--accent-blue)]">{formatPublicOrderPrice(product.price)}</p>
                        <div className="flex flex-wrap items-center gap-2">
                          {unavailable && (
                            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                              現在注文できません
                            </span>
                          )}
                          {product.current_inventory_status === 'low_stock' && (
                            <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-800">
                              売り切れ間近
                            </span>
                          )}
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-[var(--line-soft)]">
                            {product.option_groups.length > 0 ? `${product.option_groups.length}個のオプション` : 'オプションなし'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
                  )
                })()
              ))
            )}
          </section>

          <aside className="space-y-6">
            <section className="soft-panel rounded-[32px] p-6">
              {selectedProduct && selection ? (
                <div className="space-y-5">
                  <div>
                    <div className="mb-3 inline-flex rounded-full bg-[var(--accent-blue-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--accent-blue)]">
                      選択中の商品
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-bold text-[var(--text-main)]">{selectedProduct.name}</h2>
                      {getPublicOrderInventoryBadge(selectedProduct) && (
                        <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${getPublicOrderInventoryBadge(selectedProduct)?.className}`}>
                          {getPublicOrderInventoryBadge(selectedProduct)?.label}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm leading-7 text-[var(--text-sub)]">
                      {selectedProduct.description || '商品の説明は準備中です。'}
                    </p>
                      <p className="mt-4 text-lg font-bold text-[var(--accent-blue)]">{formatPublicOrderPrice(selectedProduct.price)}</p>
                  </div>

                  {isPublicOrderProductUnavailable(selectedProduct) && (
                    <div className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm font-medium text-amber-800">
                      {getPublicMobileOrderUnavailableMessage(selectedProduct)}ため、カートに追加できません。
                    </div>
                  )}

                  <div className="space-y-3">
                    {selectedProduct.option_groups.length === 0 ? (
                      <div className="rounded-3xl border border-[var(--line-soft)] bg-white px-4 py-4 text-sm text-gray-500">
                        この商品にはオプションがありません。
                      </div>
                    ) : (
                      selectedProduct.option_groups.map((group) => {
                        const selectedIds = selection.selectedChoiceIdsByGroup[group.id] ?? []

                        return (
                          <div key={group.id} className="rounded-3xl border border-[var(--line-soft)] bg-white px-4 py-4">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-semibold text-gray-800">{group.name}</h3>
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
                                    className={`flex w-full items-center justify-between rounded-2xl px-3 py-3 text-sm transition ${
                                      selected
                                        ? 'bg-[var(--accent-blue-soft)] text-[var(--accent-blue)] ring-1 ring-[var(--accent-blue)]'
                                        : 'bg-[#f8fafc] text-gray-700'
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
                  </div>

                  <div className="rounded-3xl border border-[var(--line-soft)] bg-white px-4 py-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">数量</span>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => updateQuantity(selection.quantity - 1)}
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-lg font-semibold text-slate-700"
                        >
                          -
                        </button>
                        <span className="min-w-8 text-center text-sm font-semibold text-gray-800">{selection.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(selection.quantity + 1)}
                          className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-lg font-semibold text-slate-700"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  {selectionError && (
                    <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{selectionError}</p>
                  )}

                  <div className="rounded-3xl border border-[var(--line-soft)] bg-[#f8fafc] px-4 py-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">この商品の合計</span>
                      <span className="text-base font-bold text-[var(--accent-blue)]">
                        {formatPublicOrderPrice(getPublicOrderCartLineTotal(selectedProduct, selection))}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddToCart}
                    disabled={isPublicOrderProductUnavailable(selectedProduct)}
                    className={`w-full ${publicOrderPrimaryCtaClassName}`}
                  >
                    {isPublicOrderProductUnavailable(selectedProduct) ? '売り切れ中です' : 'カートに追加'}
                  </button>
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-[var(--line-soft)] bg-white px-5 py-10 text-center text-sm text-gray-500">
                  左の商品を選ぶと、オプション内容を確認できます。
                </div>
              )}
            </section>

            <section className="soft-panel rounded-[32px] p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-[var(--text-main)]">カート</h2>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {cartItems.length} 件
                </span>
              </div>

              <div className="mt-4 rounded-3xl border border-[var(--line-soft)] bg-white px-4 py-4 text-sm text-gray-600">
                {cartItems.length === 0 ? (
                  <p>まだ商品が入っていません。商品を選んでカートに追加してください。</p>
                ) : (
                  <>
                    <p className="font-semibold text-gray-800">
                      {cartItems[0].product_name}
                      {cartItems.length > 1 ? ` ほか ${cartItems.length - 1} 件` : ''}
                    </p>
                    <p className="mt-2 text-xs text-gray-500">カートページで商品内容、受け取り名、合計金額を確認できます。</p>
                  </>
                )}
              </div>

              <div className="mt-5 rounded-3xl border border-[var(--line-soft)] bg-[#f8fafc] px-4 py-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">カート合計</span>
                  <span className="text-lg font-bold text-[var(--accent-blue)]">{formatPublicOrderPrice(cartTotal)}</span>
                </div>
              </div>

              {checkoutError && (
                <p className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{checkoutError}</p>
              )}

              <button
                type="button"
                onClick={handleGoToCart}
                disabled={cartItems.length === 0}
                className={`mt-5 w-full ${publicOrderPrimaryCtaClassName}`}
              >
                カートを見る
              </button>

              <div className="mt-4 rounded-3xl border border-dashed border-[var(--line-soft)] bg-white px-4 py-4 text-sm text-gray-500">
                カートページで注文内容を確認したあと、クレジットカード決済ページへ進みます。
              </div>
            </section>
          </aside>
        </div>
      )}
    </div>
  )
}
