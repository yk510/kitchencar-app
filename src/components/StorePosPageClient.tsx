'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ApiClientError, fetchApi } from '@/lib/api-client'
import type {
  PublicMobileOrderOptionChoice,
  PublicMobileOrderOptionGroup,
  PublicMobileOrderPagePayload,
  PublicMobileOrderProduct,
  PublicStorePosOrderStatusResponse,
  StorePosCreatePayload,
  StorePosPaymentMethod,
} from '@/types/api-payloads'

type ProductSelection = {
  selectedChoiceIdsByGroup: Record<string, string[]>
  quantity: number
}

type CartItem = {
  id: string
  product_id: string
  product_name: string
  unit_price: number
  quantity: number
  line_total: number
  selected_option_choice_ids: string[]
  selected_options: Array<{
    group_id: string
    group_name: string
    choices: Array<{
      choice_id: string
      choice_name: string
      price_delta: number
    }>
  }>
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

function formatPrice(value: number) {
  return `${value.toLocaleString()} 円`
}

function formatCartSummary(cartItems: CartItem[]) {
  if (cartItems.length === 0) return 'まだ商品が入っていません'

  return cartItems
    .map((item) => `${item.product_name} × ${item.quantity}`)
    .join(' / ')
}

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

function buildInitialSelection(product: PublicMobileOrderProduct): ProductSelection {
  const selectedChoiceIdsByGroup: Record<string, string[]> = {}

  for (const group of product.option_groups) {
    const activeChoices = group.choices.filter((choice) => choice.is_active)
    if (group.selection_type === 'single' && group.is_required && activeChoices[0]) {
      selectedChoiceIdsByGroup[group.id] = [activeChoices[0].id]
    } else {
      selectedChoiceIdsByGroup[group.id] = []
    }
  }

  return {
    selectedChoiceIdsByGroup,
    quantity: 1,
  }
}

function getCartLineTotal(product: PublicMobileOrderProduct, selection: ProductSelection) {
  const optionTotal = product.option_groups.reduce((sum, group) => {
    const selectedIds = selection.selectedChoiceIdsByGroup[group.id] ?? []
    const selectedChoices = group.choices.filter((choice) => selectedIds.includes(choice.id))
    return sum + selectedChoices.reduce((choiceSum, choice) => choiceSum + choice.price_delta, 0)
  }, 0)

  return (product.price + optionTotal) * selection.quantity
}

function validateSelection(product: PublicMobileOrderProduct, selection: ProductSelection) {
  for (const group of product.option_groups) {
    const selectedIds = selection.selectedChoiceIdsByGroup[group.id] ?? []

    if (group.is_required && selectedIds.length === 0) {
      return `${group.name} を選択してください`
    }

    if (group.selection_type === 'single' && selectedIds.length > 1) {
      return `${group.name} は1つだけ選択できます`
    }

    if (group.min_select != null && selectedIds.length < group.min_select) {
      return `${group.name} は ${group.min_select} 件以上選択してください`
    }

    if (group.max_select != null && selectedIds.length > group.max_select) {
      return `${group.name} は ${group.max_select} 件まで選択できます`
    }
  }

  if (selection.quantity < 1) {
    return '数量は1以上にしてください'
  }

  return null
}

function buildCartItem(product: PublicMobileOrderProduct, selection: ProductSelection): CartItem {
  const selectedOptions = product.option_groups
    .map((group) => {
      const selectedIds = selection.selectedChoiceIdsByGroup[group.id] ?? []
      const selectedChoices = group.choices
        .filter((choice) => selectedIds.includes(choice.id))
        .map((choice) => ({
          choice_id: choice.id,
          choice_name: choice.name,
          price_delta: choice.price_delta,
        }))

      return {
        group_id: group.id,
        group_name: group.name,
        choices: selectedChoices,
      }
    })
    .filter((group) => group.choices.length > 0)

  const selectedOptionChoiceIds = selectedOptions.flatMap((group) => group.choices.map((choice) => choice.choice_id))
  const unitPrice = getCartLineTotal(product, { ...selection, quantity: 1 })

  return {
    id: `${product.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    product_id: product.id,
    product_name: product.name,
    unit_price: unitPrice,
    quantity: selection.quantity,
    line_total: unitPrice * selection.quantity,
    selected_option_choice_ids: selectedOptionChoiceIds,
    selected_options: selectedOptions,
  }
}

function getChoicePriceLabel(choice: PublicMobileOrderOptionChoice) {
  return choice.price_delta > 0 ? `+${choice.price_delta.toLocaleString()}円` : '+0円'
}

function isProductUnavailable(product: PublicMobileOrderProduct) {
  return ['sold_out', 'not_set'].includes(product.current_inventory_status) || product.is_sold_out
}

function getUnavailableMessage(product: PublicMobileOrderProduct) {
  if (product.current_inventory_status === 'not_set') {
    return 'この商品は本日分の在庫準備中です'
  }
  return 'この商品は現在売り切れです'
}

function getInventoryBadge(product: PublicMobileOrderProduct) {
  if (product.current_inventory_status === 'not_set') {
    return { label: '在庫準備中', className: 'bg-slate-100 text-slate-700' }
  }
  if (product.current_inventory_status === 'sold_out') {
    return { label: '売り切れ', className: 'bg-amber-100 text-amber-800' }
  }
  if (product.current_inventory_status === 'low_stock') {
    return { label: '残りわずか', className: 'bg-orange-100 text-orange-800' }
  }
  if (product.tracks_inventory && product.current_remaining_quantity != null) {
    return { label: `残り ${product.current_remaining_quantity}`, className: 'bg-emerald-50 text-emerald-700' }
  }
  return null
}

export default function StorePosPageClient({ data }: { data: PublicMobileOrderPagePayload }) {
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<StorePosPaymentMethod>('cash')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submittedOrder, setSubmittedOrder] = useState<SubmittedStorePosOrder | null>(null)
  const [countdownSeconds, setCountdownSeconds] = useState(10)
  const [waitingSettlement, setWaitingSettlement] = useState(false)
  const [settlementMessage, setSettlementMessage] = useState<string | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<PublicMobileOrderProduct | null>(data.products[0] ?? null)
  const [selection, setSelection] = useState<ProductSelection | null>(
    data.products[0] ? buildInitialSelection(data.products[0]) : null
  )
  const [selectionError, setSelectionError] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<ProductFilterKey>('recommended')

  const paymentMethods = useMemo(() => buildDefaultPaymentMethods(data.store), [data.store])
  const cartTotal = useMemo(() => cartItems.reduce((sum, item) => sum + item.line_total, 0), [cartItems])
  const totalItems = useMemo(() => cartItems.reduce((sum, item) => sum + item.quantity, 0), [cartItems])
  const cartSummary = useMemo(() => formatCartSummary(cartItems), [cartItems])
  const categorizedProducts = useMemo(
    () =>
      data.products.map((product, index) => ({
        product,
        category: inferProductCategory(product),
        recommended: isRecommendedProduct(product, index),
      })),
    [data.products]
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
    if (!selectedProduct && data.products[0]) {
      setSelectedProduct(data.products[0])
      setSelection(buildInitialSelection(data.products[0]))
    }
  }, [data.products, selectedProduct])

  useEffect(() => {
    if (!selectedProduct) return
    if (filteredProducts.some((product) => product.id === selectedProduct.id)) return
    const nextProduct = filteredProducts[0] ?? data.products[0] ?? null
    setSelectedProduct(nextProduct)
    setSelection(nextProduct ? buildInitialSelection(nextProduct) : null)
  }, [data.products, filteredProducts, selectedProduct])

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
    const intervalId = window.setInterval(() => {
      void (async () => {
        try {
          const response = await fetchApi<PublicStorePosOrderStatusResponse>(
            `/api/public/store-pos/orders/${submittedOrder.order_id}?public_token=${encodeURIComponent(data.orderPage.public_token)}`,
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
            window.clearInterval(intervalId)
            return
          }

          if (response.payment_status === 'paid') {
            setSettlementMessage('店員が料金受領を記録しました。10秒後に次の注文画面へ戻ります。')
            setWaitingSettlement(false)
            window.clearInterval(intervalId)
          }
        } catch {
          // Keep polling; temporary fetch failure should not break the kiosk flow.
        }
      })()
    }, 2000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [submittedOrder, data.orderPage.public_token])

  function selectProduct(product: PublicMobileOrderProduct) {
    setSelectedProduct(product)
    setSelection(buildInitialSelection(product))
    setSelectionError(null)
  }

  function toggleChoice(group: PublicMobileOrderOptionGroup, choiceId: string) {
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

    const validationError = validateSelection(selectedProduct, selection)
    if (validationError) {
      setSelectionError(validationError)
      return
    }

    setCartItems((current) => [...current, buildCartItem(selectedProduct, selection)])
    setSelection(buildInitialSelection(selectedProduct))
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
    setSubmittedOrder(null)
    setCartItems([])
    setSubmitError(null)
    setSelectedPaymentMethod(paymentMethods[0] ?? 'cash')
    setCountdownSeconds(10)
    setWaitingSettlement(false)
    setSettlementMessage(null)
    if (data.products[0]) {
      setSelectedProduct(data.products[0])
      setSelection(buildInitialSelection(data.products[0]))
    } else {
      setSelectedProduct(null)
      setSelection(null)
    }
    setSelectionError(null)
  }

  function handleClearCart() {
    setCartItems([])
    setSubmitError(null)
  }

  function handleBackToPreviousPage() {
    if (typeof window === 'undefined') return
    if (window.history.length > 1) {
      window.history.back()
      return
    }
    window.location.href = '/vendor/mobile-order'
  }

  async function handleSubmitOrder() {
    if (!data.activeSchedule) {
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
        public_token: data.orderPage.public_token,
        pickup_nickname: '店頭POS',
        payment_method: selectedPaymentMethod,
        pos_device_label: data.store.store_pos_terminal_name ?? 'front-tablet',
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
                  {submittedOrder.payment_method === 'cash'
                    ? '現金'
                    : submittedOrder.payment_method === 'paypay'
                      ? 'PayPay'
                      : 'その他'}
                </p>
              </div>
              <div className="rounded-[28px] bg-[#f8fbff] px-6 py-6 ring-1 ring-[var(--line-soft)]">
                <p className="text-sm font-semibold text-gray-500">合計金額</p>
                <p className="mt-3 text-2xl font-black text-[var(--text-main)]">{formatPrice(submittedOrder.total_amount)}</p>
              </div>
            </div>

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

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef4ff_100%)] px-4 py-4 md:px-5 md:py-6">
      <div className="mx-auto max-w-7xl space-y-5 pb-36">
        <section className="sticky top-0 z-30 overflow-hidden rounded-[32px] border border-[var(--line-soft)] bg-white/95 shadow-[0_24px_60px_rgba(15,23,42,0.12)] backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line-soft)] px-4 py-3 md:px-6">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Store POS</p>
              <p className="truncate text-sm font-semibold text-slate-500">{data.store.store_name}</p>
            </div>
            <div className="flex items-center gap-2">
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
          </div>
          <div className="px-4 py-4 md:px-6">
            <p className="text-sm font-medium leading-6 text-slate-500">
              商品を選んで、内容を確認したら注文を確定してください。ご注文内容とお支払い合計は画面下部に固定表示されます。
            </p>
          </div>
        </section>

        <section className="rounded-[36px] border border-[var(--line-soft)] bg-white px-6 py-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-sky-700">
                Store POS
              </div>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-[var(--text-main)]">
                {data.store.store_name}
              </h1>
              <p className="mt-2 text-base leading-7 text-[var(--text-sub)]">
                商品を選んで、内容を確認したら注文を確定してください。お支払いは店員がご案内します。
              </p>
            </div>
            <div className="max-w-sm rounded-[24px] bg-[#f8fbff] px-5 py-4 ring-1 ring-[var(--line-soft)]">
              <p className="text-sm font-semibold text-gray-500">ご注文の進め方</p>
              <p className="mt-2 text-sm leading-6 text-[var(--text-sub)]">
                1. 商品を選ぶ  2. オプションと数量を決める  3. お支払い方法を選ぶ  4. 注文を確定する
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[36px] border border-[var(--line-soft)] bg-white px-6 py-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-[var(--text-main)]">商品を選ぶ</h2>
                <p className="mt-1 text-sm text-[var(--text-sub)]">おすすめやカテゴリから商品を選び、右側で数量やトッピングを決められます。</p>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
                {filteredProducts.length} / {data.products.length} 商品
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
                const inventoryBadge = getInventoryBadge(product)
                const active = selectedProduct?.id === product.id
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => selectProduct(product)}
                    className={`rounded-[30px] border px-5 py-5 text-left shadow-[0_10px_28px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 ${
                      active
                        ? 'border-[var(--accent-blue)] bg-[var(--accent-blue-soft)]'
                        : 'border-[var(--line-soft)] bg-[#fcfdff] hover:bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="mb-4 overflow-hidden rounded-[24px] border border-[var(--line-soft)] bg-[#f8fbff]">
                          {product.image_url ? (
                            <img src={product.image_url} alt={product.name} className="h-44 w-full object-cover" />
                          ) : (
                            <div className="flex h-44 items-center justify-center text-sm font-semibold text-slate-400">
                              商品画像を準備中です
                            </div>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-xl font-black text-[var(--text-main)]">{product.name}</h3>
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
                        {product.description ? (
                          <p className="mt-2 text-sm leading-6 text-[var(--text-sub)]">{product.description}</p>
                        ) : (
                          <p className="mt-2 text-sm leading-6 text-[var(--text-sub)]">店頭POSの簡易注文です</p>
                        )}
                      </div>
                      <div className="rounded-full bg-[var(--accent-blue)]/10 px-3 py-1 text-sm font-semibold text-[var(--accent-blue)]">
                        {formatPrice(product.price)}
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between gap-3 text-sm">
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
                          <div className="mb-4 overflow-hidden rounded-[24px] border border-[var(--line-soft)] bg-white">
                            {selectedProduct.image_url ? (
                              <img src={selectedProduct.image_url} alt={selectedProduct.name} className="h-52 w-full object-cover" />
                            ) : (
                              <div className="flex h-52 items-center justify-center text-sm font-semibold text-slate-400">
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
                            {getInventoryBadge(selectedProduct) && (
                              <span
                                className={`rounded-full px-3 py-1 text-[11px] font-semibold ${getInventoryBadge(selectedProduct)?.className}`}
                              >
                                {getInventoryBadge(selectedProduct)?.label}
                              </span>
                            )}
                          </div>
                          <p className="mt-2 text-sm leading-6 text-[var(--text-sub)]">{selectedProduct.description || '商品の説明は準備中です。'}</p>
                        </div>
                        <div className="rounded-full bg-[var(--accent-blue)]/10 px-3 py-1 text-sm font-semibold text-[var(--accent-blue)]">
                          {formatPrice(selectedProduct.price)}
                        </div>
                      </div>
                    </div>

                    {isProductUnavailable(selectedProduct) && (
                      <div className="rounded-[24px] bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                        {getUnavailableMessage(selectedProduct)}ため、カートに追加できません。
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
                                    <span className="font-medium">{getChoicePriceLabel(choice)}</span>
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
                            {formatPrice(getCartLineTotal(selectedProduct, selection))}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleAddSelectedProduct}
                          disabled={isProductUnavailable(selectedProduct)}
                          className={primaryButtonClassName}
                        >
                          {isProductUnavailable(selectedProduct) ? '売り切れ中です' : 'カートに追加'}
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
                          <p className="mt-1 text-sm text-[var(--text-sub)]">{formatPrice(item.unit_price)} / 1点</p>
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
                        <p className="text-lg font-black text-[var(--accent-blue)]">{formatPrice(item.line_total)}</p>
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
              <h2 className="text-2xl font-black text-[var(--text-main)]">お支払い方法</h2>
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

              <div className="mt-4 rounded-[24px] bg-slate-50 px-4 py-3 text-sm text-slate-600 ring-1 ring-[var(--line-soft)]">
                お支払い方法を選んだあと、右下の <span className="font-semibold text-[var(--text-main)]">注文を確定する</span> を押してください。
              </div>

              {submitError && (
                <div className="mt-5 rounded-[24px] bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {submitError}
                </div>
              )}

              <div className="mt-6 rounded-[28px] bg-[#f8fbff] px-5 py-5 ring-1 ring-[var(--line-soft)]">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-500">お支払い合計</p>
                    <p className="mt-2 text-4xl font-black text-[var(--text-main)]">{formatPrice(cartTotal)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSubmitOrder}
                    disabled={submitting || cartItems.length === 0}
                    className={primaryButtonClassName}
                  >
                    {submitting ? '注文を作成中...' : '注文を確定する'}
                  </button>
                </div>
              </div>
            </section>
          </div>
        </section>

        <section className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-4 md:px-6">
          <div className="pointer-events-auto mx-auto max-w-7xl rounded-[28px] border border-[var(--line-soft)] bg-white/95 px-4 py-4 shadow-[0_-12px_40px_rgba(15,23,42,0.12)] backdrop-blur md:px-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">注文内容の確認</p>
                <p className="mt-1 truncate text-sm font-medium text-slate-500">{cartSummary}</p>
                <div className="mt-2 flex flex-wrap items-center gap-4">
                  <p className="text-lg font-black text-[var(--text-main)]">{formatPrice(cartTotal)}</p>
                  <p className="text-sm font-semibold text-slate-500">{totalItems} 点</p>
                  <p className="text-sm font-semibold text-slate-500">
                    支払方法: {selectedPaymentMethod === 'cash' ? '現金' : selectedPaymentMethod === 'paypay' ? 'PayPay' : 'その他'}
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handleClearCart}
                  disabled={cartItems.length === 0}
                  className="inline-flex items-center justify-center rounded-[24px] bg-white px-5 py-4 text-base font-semibold text-slate-600 ring-1 ring-[var(--line-soft)] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  カートを空にする
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
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
