'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ApiClientError, fetchApi } from '@/lib/api-client'
import LoadingLine from '@/components/LoadingLine'
import PublicOrderItemsPanel from '@/components/PublicOrderItemsPanel'
import { applyInventorySnapshotToPayload } from '@/lib/public-mobile-order-data'
import {
  buildInitialProductSelection,
  buildPublicOrderCartItemCore,
  getPublicOrderCartLineTotal,
  getPublicOrderChoicePriceLabel,
  getPublicOrderInventoryBadge,
  getPublicOrderProductUnavailableState,
  isPublicOrderProductUnavailable,
  type PublicOrderProductSelection,
  type PublicOrderSelectedOptionGroup,
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
  formatStorePosPaymentMethodLabel,
} from '@/lib/public-order-display'
import { useLiveRefresh } from '@/lib/use-live-refresh'
import type {
  PublicMobileOrderInventorySnapshot,
  PublicMobileOrderPagePayload,
  PublicMobileOrderProduct,
  PublicStorePosOrderStatusResponse,
  StorePosCreatePayload,
  StorePosPaymentMethod,
} from '@/types/api-payloads'

type CartItem = {
  id: string
  product_id: string
  product_name: string
  unit_price: number
  quantity: number
  line_total: number
  selected_option_choice_ids: string[]
  selected_options: PublicOrderSelectedOptionGroup[]
}

type StorePosCreateResponse = {
  order_id: string
  order_number: string
  payment_status: 'pending' | 'paid'
  payment_method: StorePosPaymentMethod
  total_amount: number
}

type SubmittedStorePosOrder = StorePosCreateResponse & {
  status: 'placed' | 'cancelled'
  paid_at: string | null
  cancelled_at: string | null
}

type ProductDisplayCategory = 'main' | 'side' | 'drink' | 'other'
type ProductFilterKey = 'all' | 'recommended' | ProductDisplayCategory

const primaryButtonClassName =
  'inline-flex items-center justify-center rounded-[28px] bg-[var(--accent-blue)] px-6 py-4 text-base font-semibold text-white shadow-[0_14px_32px_rgba(37,99,235,0.28)] transition hover:brightness-[1.03] disabled:cursor-not-allowed disabled:opacity-50'
const secondaryButtonClassName =
  'inline-flex items-center justify-center rounded-[28px] bg-white px-6 py-4 text-base font-semibold text-slate-700 ring-1 ring-[var(--line-soft)] transition hover:bg-slate-50'

function normalizeText(value: string | null | undefined) {
  return String(value ?? '').toLowerCase()
}

function inferProductCategory(product: PublicMobileOrderProduct): ProductDisplayCategory {
  if (
    product.display_category === 'main' ||
    product.display_category === 'side' ||
    product.display_category === 'drink' ||
    product.display_category === 'other'
  ) {
    return product.display_category
  }

  const source = `${normalizeText(product.name)} ${normalizeText(product.description)}`

  if (
    source.includes('ラッシー') ||
    source.includes('コーヒー') ||
    source.includes('ドリンク') ||
    source.includes('ジュース') ||
    source.includes('ティー') ||
    source.includes('ソーダ') ||
    source.includes('drink')
  ) {
    return 'drink'
  }

  if (
    source.includes('ポテト') ||
    source.includes('サイド') ||
    source.includes('トッピング') ||
    source.includes('副菜') ||
    source.includes('セット') ||
    source.includes('side')
  ) {
    return 'side'
  }

  if (
    source.includes('カレー') ||
    source.includes('丼') ||
    source.includes('メイン') ||
    source.includes('プレート') ||
    source.includes('main') ||
    source.includes('スペシャル')
  ) {
    return 'main'
  }

  return 'other'
}

function isRecommendedProduct(product: PublicMobileOrderProduct, index: number) {
  if (typeof product.is_recommended === 'boolean') {
    return product.is_recommended
  }

  const source = `${normalizeText(product.name)} ${normalizeText(product.description)}`
  return (
    source.includes('おすすめ') ||
    source.includes('人気') ||
    source.includes('定番') ||
    source.includes('スペシャル') ||
    index < 2
  )
}

function getCategoryLabel(category: ProductFilterKey) {
  switch (category) {
    case 'all':
      return 'すべて'
    case 'recommended':
      return 'おすすめ'
    case 'main':
      return 'メイン'
    case 'side':
      return 'サイド'
    case 'drink':
      return 'ドリンク'
    default:
      return 'その他'
  }
}

function getDefaultProductFilter(products: PublicMobileOrderProduct[]): ProductFilterKey {
  const categorizedProducts = products.map((product, index) => ({
    category: inferProductCategory(product),
    recommended: isRecommendedProduct(product, index),
  }))

  if (categorizedProducts.some((entry) => entry.recommended)) {
    return 'recommended'
  }

  if (categorizedProducts.some((entry) => entry.category === 'main')) {
    return 'main'
  }

  return 'all'
}

function getInitialSelectedProduct(
  products: PublicMobileOrderProduct[],
  filter: ProductFilterKey
): PublicMobileOrderProduct | null {
  const categorizedProducts = products.map((product, index) => ({
    product,
    category: inferProductCategory(product),
    recommended: isRecommendedProduct(product, index),
  }))

  const filteredProducts =
    filter === 'all'
      ? categorizedProducts
      : filter === 'recommended'
        ? categorizedProducts.filter((entry) => entry.recommended)
        : categorizedProducts.filter((entry) => entry.category === filter)

  return filteredProducts[0]?.product ?? products[0] ?? null
}

function buildDefaultPaymentMethods(
  store: PublicMobileOrderPagePayload['store']
): StorePosPaymentMethod[] {
  const values = Array.isArray(store.store_pos_enabled_payment_methods)
    ? store.store_pos_enabled_payment_methods
    : ['cash', 'paypay']
  return values.filter((value): value is StorePosPaymentMethod =>
    ['cash', 'paypay', 'other'].includes(value)
  )
}

function getUnavailableMessage(product: PublicMobileOrderProduct) {
  const unavailableState = getPublicOrderProductUnavailableState(product)
  if (unavailableState === 'loading') {
    return 'この商品の在庫を確認しているため、カートに追加できません。'
  }
  if (unavailableState === 'not_set') {
    return 'この商品は現在在庫準備中のため、カートに追加できません。'
  }
  return 'この商品は現在売り切れのため、カートに追加できません。'
}

export default function StorePosPageClient({ data }: { data: PublicMobileOrderPagePayload }) {
  const [pageData, setPageData] = useState<PublicMobileOrderPagePayload>(data)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<StorePosPaymentMethod>('cash')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submittedOrder, setSubmittedOrder] = useState<SubmittedStorePosOrder | null>(null)
  const [confirmingPage, setConfirmingPage] = useState(false)
  const [resettingToMenu, setResettingToMenu] = useState(false)
  const [countdownSeconds, setCountdownSeconds] = useState(10)
  const [waitingSettlement, setWaitingSettlement] = useState(false)
  const [settlementMessage, setSettlementMessage] = useState<string | null>(null)
  const [inventoryRefreshing, setInventoryRefreshing] = useState(!data.inventoryHydrated)
  const [activeFilter, setActiveFilter] = useState<ProductFilterKey>(() => getDefaultProductFilter(data.products))
  const [selectedProduct, setSelectedProduct] = useState<PublicMobileOrderProduct | null>(() => {
    const defaultFilter = getDefaultProductFilter(data.products)
    return getInitialSelectedProduct(data.products, defaultFilter)
  })
  const [selection, setSelection] = useState<PublicOrderProductSelection | null>(() => {
    const defaultFilter = getDefaultProductFilter(pageData.products)
    const initialProduct = getInitialSelectedProduct(pageData.products, defaultFilter)
    return initialProduct ? buildInitialProductSelection(initialProduct) : null
  })
  const [selectionError, setSelectionError] = useState<string | null>(null)
  const isConfirmStep = searchParams.get('step') === 'confirm'

  const paymentMethods = useMemo(() => buildDefaultPaymentMethods(pageData.store), [pageData.store])
  const cartTotal = useMemo(() => cartItems.reduce((sum, item) => sum + item.line_total, 0), [cartItems])
  const totalItems = useMemo(() => cartItems.reduce((sum, item) => sum + item.quantity, 0), [cartItems])
  const cartSummary = useMemo(() => formatPublicOrderCartSummary(cartItems), [cartItems])
  const categorizedProducts = useMemo(
    () =>
      pageData.products.map((product, index) => ({
        product,
        category: inferProductCategory(product),
        recommended: isRecommendedProduct(product, index),
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
    if (submittedOrder.payment_status !== 'paid' && submittedOrder.status !== 'cancelled') return

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
  }, [submittedOrder])

  useEffect(() => {
    if (!submittedOrder) return
    if (submittedOrder.payment_status === 'paid' || submittedOrder.status === 'cancelled') return
    setWaitingSettlement(true)
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
          return
        }

        if (response.payment_status === 'paid') {
          setSettlementMessage('店員が料金受領を記録しました。10秒後に次の注文画面へ戻ります。')
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

    const defaultFilter = getDefaultProductFilter(pageData.products)
    const nextState = buildResolvedSelectionState(
      pageData.products,
      null,
      pageData.products.filter((product, index) => {
        if (defaultFilter === 'all') return true
        if (defaultFilter === 'recommended') {
          return isRecommendedProduct(product, index)
        }
        return inferProductCategory(product) === defaultFilter
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
      })
      setWaitingSettlement(true)
      setSettlementMessage('店員が会計確認を行っています。料金受領またはキャンセル後に自動で次の注文へ進みます。')
    } catch (error) {
      setSubmitError(error instanceof ApiClientError ? error.message : '注文の作成に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  if (submittedOrder) {
    const isCancelled = submittedOrder.status === 'cancelled'
    const isSettled = submittedOrder.payment_status === 'paid' || isCancelled

    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef4ff_100%)] px-5 py-8">
        <div className="mx-auto max-w-5xl">
          <section className="rounded-[40px] border border-[var(--line-soft)] bg-white px-8 py-10 shadow-[0_28px_70px_rgba(15,23,42,0.08)]">
            <div
              className={`inline-flex rounded-full px-4 py-2 text-sm font-semibold ${
                isCancelled ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              {isCancelled ? 'ORDER CANCELLED' : isSettled ? 'PAYMENT CONFIRMED' : 'WAITING FOR CASHIER'}
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-tight text-[var(--text-main)]">
              {isCancelled ? 'この注文はキャンセルされました' : isSettled ? 'お支払い確認が完了しました' : 'ご注文を受け付けました'}
            </h1>
            <p className="mt-4 text-lg leading-8 text-[var(--text-sub)]">
              {isCancelled
                ? '内容の見直しが必要な場合は、店員にお声がけください。'
                : isSettled
                  ? '次のお客様のために、まもなく商品一覧へ戻ります。'
                  : '店員へお支払いください。店員が会計確認を行うまで、この画面でお待ちください。'}
            </p>

            <div className="mt-8 grid gap-5 md:grid-cols-3">
              <div className="rounded-[28px] bg-[#f8fbff] px-6 py-6 ring-1 ring-[var(--line-soft)]">
                <p className="text-sm font-semibold text-gray-500">受付番号</p>
                <p className="mt-3 text-3xl font-black tracking-[0.08em] text-[var(--accent-blue)]">
                  {submittedOrder.order_number}
                </p>
              </div>
              <div className="rounded-[28px] bg-[#f8fbff] px-6 py-6 ring-1 ring-[var(--line-soft)]">
                <p className="text-sm font-semibold text-gray-500">支払方法</p>
                <p className="mt-3 text-2xl font-black text-[var(--text-main)]">
                  {formatStorePosPaymentMethodLabel(submittedOrder.payment_method)}
                </p>
              </div>
              <div className="rounded-[28px] bg-[#f8fbff] px-6 py-6 ring-1 ring-[var(--line-soft)]">
                <p className="text-sm font-semibold text-gray-500">合計金額</p>
                <p className="mt-3 text-2xl font-black text-[var(--text-main)]">{formatPublicOrderPrice(submittedOrder.total_amount)}</p>
              </div>
            </div>

            <PublicOrderItemsPanel
              title="ご注文内容"
              description="店員と一緒に、商品と金額をご確認ください。"
              items={cartItems}
              itemKeyPrefix="submitted"
              totalItems={totalItems}
              panelClassName="mt-8 rounded-[32px] bg-[#f8fbff] px-6 py-6 ring-1 ring-[var(--line-soft)]"
            />

            <div
              className={`mt-8 rounded-[28px] border border-dashed px-5 py-4 text-sm ${
                isCancelled
                  ? 'border-rose-200 bg-rose-50 text-rose-700'
                  : isSettled
                    ? 'border-[var(--line-soft)] bg-[#fffdf7] text-amber-700'
                    : 'border-sky-200 bg-sky-50 text-sky-700'
              }`}
            >
              {settlementMessage}
              {isSettled ? ` あと ${countdownSeconds} 秒` : waitingSettlement ? ' 店員側の処理を確認中です。' : ''}
            </div>

            {resettingToMenu ? (
              <div className="mt-4 rounded-[24px] bg-[var(--accent-blue-soft)] px-4 py-4">
                <LoadingLine label="次の注文画面へ戻っています..." />
              </div>
            ) : null}

            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" onClick={handleResetForNextCustomer} className={primaryButtonClassName}>
                次の注文を始める
              </button>
            </div>
          </section>
        </div>
      </div>
    )
  }

  if (isConfirmStep) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef4ff_100%)] px-4 py-4 md:px-5 md:py-6">
        {submitting ? (
          <div className="pointer-events-none fixed inset-x-0 top-0 z-50 px-4 pt-3 md:px-6">
            <div className="mx-auto max-w-5xl rounded-full bg-white/95 px-4 py-3 shadow-[0_12px_34px_rgba(15,23,42,0.12)] backdrop-blur">
              <LoadingLine label="注文を送信しています..." />
            </div>
          </div>
        ) : null}
        <div className="mx-auto max-w-5xl space-y-6 pb-24">
          <section className="rounded-[36px] border border-[var(--line-soft)] bg-white px-6 py-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] md:px-8">
            <div className="inline-flex rounded-full bg-[var(--accent-blue-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--accent-blue)]">
              Final check
            </div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-[var(--text-main)]">ご注文内容をご確認ください</h1>
            <p className="mt-2 text-sm leading-7 text-[var(--text-sub)]">
              ご注文内容をご確認いただき、支払方法を選択の上、注文を確定してください。
            </p>
          </section>

          <PublicOrderItemsPanel
            title="ご注文内容"
            description="商品名、数量、トッピング、金額に間違いがないかご確認ください。"
            items={cartItems}
            itemKeyPrefix="confirm-page"
            totalItems={totalItems}
            panelClassName="rounded-[36px] border border-[var(--line-soft)] bg-white px-6 py-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] md:px-8"
          />

          <section className="rounded-[36px] border border-[var(--line-soft)] bg-white px-6 py-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] md:px-8">
            <h2 className="text-2xl font-black text-[var(--text-main)]">お支払い方法</h2>
            <p className="mt-1 text-sm text-[var(--text-sub)]">店員へお支払いいただく方法をお選びください。</p>
            <div className="mt-5 grid gap-3">
              {paymentMethods.map((method) => {
                const label = method === 'cash' ? '現金' : method === 'paypay' ? 'PayPay' : 'その他'
                const active = selectedPaymentMethod === method
                return (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setSelectedPaymentMethod(method)}
                    className={`rounded-[26px] px-5 py-4 text-left text-lg font-bold transition ${
                      active
                        ? 'bg-[var(--accent-blue)] text-white shadow-[0_14px_32px_rgba(37,99,235,0.26)]'
                        : 'bg-[#fbfdff] text-[var(--text-main)] ring-1 ring-[var(--line-soft)] hover:bg-white'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>

            <div className="mt-5 grid gap-3 rounded-[28px] bg-[#fffdf7] px-5 py-5 ring-1 ring-[var(--line-soft)] md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">お支払い方法</p>
                <p className="mt-2 text-2xl font-black text-[var(--text-main)]">
                  {formatStorePosPaymentMethodLabel(selectedPaymentMethod)}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">合計金額</p>
                <p className="mt-2 text-2xl font-black text-[var(--text-main)]">{formatPublicOrderPrice(cartTotal)}</p>
              </div>
            </div>

            {submitError && (
              <div className="mt-5 rounded-[24px] bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {submitError}
              </div>
            )}

            {submitting ? (
              <div className="mt-5 rounded-[24px] bg-[var(--accent-blue-soft)] px-4 py-4">
                <LoadingLine label="ご注文内容を送信しています。しばらくお待ちください。" />
              </div>
            ) : null}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={returnToProductSelection}
                className="inline-flex items-center justify-center rounded-[24px] bg-white px-5 py-4 text-base font-semibold text-slate-600 ring-1 ring-[var(--line-soft)] transition hover:bg-slate-50"
              >
                商品選択に戻る
              </button>
              <button
                type="button"
                onClick={handleSubmitOrder}
                disabled={submitting || cartItems.length === 0}
                className="inline-flex min-w-[220px] items-center justify-center rounded-[24px] bg-[var(--accent-blue)] px-6 py-4 text-lg font-bold text-white shadow-[0_18px_40px_rgba(37,99,235,0.3)] transition hover:brightness-[1.03] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? '注文を作成中...' : '注文を確定する'}
              </button>
            </div>
          </section>
        </div>
      </div>
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
                    {getCategoryLabel(filterKey)}
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
                        <div className="mb-4 flex h-44 items-center justify-center overflow-hidden rounded-[24px] border border-[var(--line-soft)] bg-[#f8fbff] p-3">
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="h-full w-full object-contain object-center"
                            />
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
                          {getCategoryLabel(inferProductCategory(product))}
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
                              <img
                                src={selectedProduct.image_url}
                                alt={selectedProduct.name}
                                className="h-full w-full object-contain object-center"
                              />
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
                        {getUnavailableMessage(selectedProduct)}
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
