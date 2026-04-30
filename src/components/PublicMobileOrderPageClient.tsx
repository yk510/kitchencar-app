'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { ApiClientError, fetchApi } from '@/lib/api-client'
import type {
  PublicMobileOrderCheckoutResponse,
  PublicMobileOrderCheckoutStatusResponse,
  PublicMobileOrderOptionChoice,
  PublicMobileOrderOptionGroup,
  PublicMobileOrderPagePayload,
  PublicMobileOrderProduct,
} from '@/types/api-payloads'

const LIFF_ORDER_CONTEXT_STORAGE_KEY = 'mobile-order:liff-context'

type ProductSelection = {
  selectedChoiceIdsByGroup: Record<string, string[]>
  quantity: number
}

type CartItem = {
  id: string
  product_id: string
  product_name: string
  product_price: number
  quantity: number
  selected_options: Array<{
    group_id: string
    group_name: string
    choices: Array<{
      choice_id: string
      choice_name: string
      price_delta: number
    }>
  }>
  line_total: number
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatPrice(value: number) {
  return `${value.toLocaleString()} 円`
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

  return {
    id: `${product.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    product_id: product.id,
    product_name: product.name,
    product_price: product.price,
    quantity: selection.quantity,
    selected_options: selectedOptions,
    line_total: getCartLineTotal(product, selection),
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
  const [selectedProduct, setSelectedProduct] = useState<PublicMobileOrderProduct | null>(null)
  const [selection, setSelection] = useState<ProductSelection | null>(null)
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [pickupNickname, setPickupNickname] = useState('')
  const [selectionError, setSelectionError] = useState<string | null>(null)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [completedOrder, setCompletedOrder] = useState<PublicMobileOrderCheckoutStatusResponse | null>(null)
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false)

  const currentStep = searchParams.get('step') === 'review' ? 'review' : 'menu'

  const availableProducts = useMemo(
    () => pageData.products.filter((product) => product.is_published && !isProductUnavailable(product)),
    [pageData.products]
  )

  useEffect(() => {
    setPageData(data)
  }, [data])

  useEffect(() => {
    let disposed = false

    async function refreshPageData() {
      try {
        const next = await fetchApi<PublicMobileOrderPagePayload>(
          `/api/public/mobile-order/${pageData.orderPage.public_token}`,
          { cache: 'no-store' }
        )
        if (!disposed) {
          setPageData(next)
        }
      } catch {
        // Public page should keep the current snapshot if refresh fails.
      }
    }

    const intervalId = window.setInterval(() => {
      void refreshPageData()
    }, 15000)

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void refreshPageData()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      disposed = true
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [pageData.orderPage.public_token])

  useEffect(() => {
    if (!selectedProduct) return

    const nextSelected = pageData.products.find((product) => product.id === selectedProduct.id) ?? null
    if (!nextSelected) {
      setSelectedProduct(null)
      setSelection(null)
      return
    }

    setSelectedProduct(nextSelected)
  }, [pageData.products, selectedProduct])

  useEffect(() => {
    if (!selectedProduct && availableProducts[0]) {
      setSelectedProduct(availableProducts[0])
      setSelection(buildInitialSelection(availableProducts[0]))
    }
  }, [availableProducts, selectedProduct])

  function replaceStep(step: 'menu' | 'review') {
    const params = new URLSearchParams(searchParams.toString())
    if (step === 'review') {
      params.set('step', 'review')
    } else {
      params.delete('step')
      params.delete('checkout_session_id')
      params.delete('order_id')
      params.delete('checkout_cancelled')
    }

    const query = params.toString()
    const nextUrl = query ? `${pathname}?${query}` : pathname
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
    if (currentStep === 'review' && cartItems.length === 0) {
      replaceStep('menu')
    }
  }, [cartItems.length, currentStep])

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
          const next = await fetchApi<PublicMobileOrderPagePayload>(
            `/api/public/mobile-order/${pageData.orderPage.public_token}`,
            { cache: 'no-store' }
          )
          if (!disposed) {
            setPageData(next)
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
    if (isProductUnavailable(product)) {
      setCheckoutError(getUnavailableMessage(product))
      return
    }
    setSelectedProduct(product)
    setSelection(buildInitialSelection(product))
    setSelectionError(null)
    setCheckoutError(null)
  }

  function toggleChoice(group: PublicMobileOrderOptionGroup, choiceId: string) {
    if (!selection) return

    setSelection((current) => {
      if (!current) return current

      const currentIds = current.selectedChoiceIdsByGroup[group.id] ?? []
      const nextIds =
        group.selection_type === 'single'
          ? currentIds.includes(choiceId)
            ? []
            : [choiceId]
          : currentIds.includes(choiceId)
            ? currentIds.filter((id) => id !== choiceId)
            : [...currentIds, choiceId]

      return {
        ...current,
        selectedChoiceIdsByGroup: {
          ...current.selectedChoiceIdsByGroup,
          [group.id]: nextIds,
        },
      }
    })
    setSelectionError(null)
  }

  function updateQuantity(nextQuantity: number) {
    setSelection((current) => (current ? { ...current, quantity: Math.max(1, nextQuantity) } : current))
  }

  function handleAddToCart() {
    if (!selectedProduct || !selection) return
    if (isProductUnavailable(selectedProduct)) {
      setCheckoutError(getUnavailableMessage(selectedProduct))
      return
    }

    const error = validateSelection(selectedProduct, selection)
    if (error) {
      setSelectionError(error)
      return
    }

    setCartItems((current) => [...current, buildCartItem(selectedProduct, selection)])
    setSelection(buildInitialSelection(selectedProduct))
    setSelectionError(null)
    setCheckoutError(null)
  }

  function removeCartItem(cartItemId: string) {
    setCartItems((current) => current.filter((item) => item.id !== cartItemId))
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
    replaceStep('review')
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

  const cartTotal = useMemo(() => cartItems.reduce((sum, item) => sum + item.line_total, 0), [cartItems])

  if (completedOrder) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 lg:px-6">
        <section className="soft-panel rounded-[36px] px-6 py-8 text-center lg:px-8">
          <div className="badge-soft badge-blue inline-block">ORDER COMPLETE</div>
          <h1 className="mt-5 text-3xl font-black tracking-tight text-[var(--text-main)]">ご注文を受け付けました</h1>
          <p className="mt-4 text-sm leading-7 text-[var(--text-sub)]">
            店頭でのお受け取り時に、注文番号とニックネームをお伝えください。
          </p>

          <div className="mt-8 rounded-[32px] border border-[var(--line-soft)] bg-white px-6 py-7">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">注文番号</p>
            <p className="mt-3 text-4xl font-black tracking-[0.12em] text-[var(--accent-blue)]">
              {completedOrder.order_number}
            </p>
            <p className="mt-4 text-sm text-gray-600">ニックネーム: {completedOrder.pickup_nickname}</p>
            <p className="mt-2 text-sm text-gray-600">合計: {formatPrice(completedOrder.total_amount)}</p>
          </div>

          <button
            type="button"
            onClick={resetToOrderPage}
            className="mt-6 rounded-full bg-[var(--accent-blue)] px-5 py-3 text-sm font-semibold text-white"
          >
            もう一度注文ページを見る
          </button>
        </section>
      </div>
    )
  }

  if (isVerifyingPayment) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-10 lg:px-6">
        <section className="soft-panel rounded-[36px] px-6 py-8 text-center lg:px-8">
          <div className="badge-soft badge-blue inline-block">PAYMENT CHECK</div>
          <h1 className="mt-5 text-3xl font-black tracking-tight text-[var(--text-main)]">決済完了を確認しています</h1>
          <p className="mt-4 text-sm leading-7 text-[var(--text-sub)]">
            クレジットカード決済の結果を確認しています。数秒そのままでお待ちください。
          </p>
        </section>
      </div>
    )
  }

  if (currentStep === 'review') {
    return (
      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 lg:px-6">
        <section className="soft-panel rounded-[36px] px-6 py-7 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="badge-soft badge-blue inline-block">ORDER REVIEW</div>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-[var(--text-main)]">注文内容の確認</h1>
              <p className="mt-3 text-sm leading-7 text-[var(--text-sub)]">
                商品、数量、受け取り名を確認してから、クレジットカード決済へ進みます。
              </p>
            </div>
            <button
              type="button"
              onClick={() => replaceStep('menu')}
              className="rounded-full bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-700"
            >
              内容を修正する
            </button>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="soft-panel rounded-[32px] p-6">
            <h2 className="text-lg font-semibold text-[var(--text-main)]">ご注文内容</h2>
            <div className="mt-4 space-y-3 text-sm text-gray-600">
              {cartItems.map((item) => (
                <div key={`review-page-${item.id}`} className="rounded-2xl bg-white px-4 py-4 ring-1 ring-[var(--line-soft)]">
                  <p className="font-semibold text-gray-800">
                    {item.product_name} x{item.quantity}
                  </p>
                  {item.selected_options.length > 0 && (
                    <div className="mt-2 space-y-1 text-xs text-gray-500">
                      {item.selected_options.map((group) => (
                        <p key={`review-page-${item.id}-${group.group_id}`}>
                          {group.group_name}: {group.choices.map((choice) => choice.choice_name).join(' / ')}
                        </p>
                      ))}
                    </div>
                  )}
                  <p className="mt-2 text-sm font-bold text-[var(--accent-blue)]">{formatPrice(item.line_total)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <section className="soft-panel rounded-[32px] p-6">
              <h2 className="text-lg font-semibold text-[var(--text-main)]">お受け取り情報</h2>
              <div className="mt-4 rounded-2xl bg-white px-4 py-4 ring-1 ring-[var(--line-soft)] text-sm text-gray-600">
                <p>
                  受け取りニックネーム:
                  <span className="ml-2 font-semibold text-gray-800">{pickupNickname.trim()}</span>
                </p>
                <p className="mt-2">
                  合計金額:
                  <span className="ml-2 font-semibold text-[var(--accent-blue)]">{formatPrice(cartTotal)}</span>
                </p>
              </div>
            </section>

            {checkoutError && (
              <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{checkoutError}</p>
            )}

            <section className="soft-panel rounded-[32px] p-6">
              <div className="rounded-3xl border border-dashed border-[var(--line-soft)] bg-white px-4 py-4 text-sm text-gray-500">
                次の画面でクレジットカード情報を入力して、お支払いを完了します。
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => replaceStep('menu')}
                  className="flex-1 rounded-full bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-700"
                >
                  内容を修正する
                </button>
                <button
                  type="button"
                  onClick={() => void handleSubmitOrder()}
                  disabled={submitting}
                  className="flex-1 rounded-full bg-[var(--accent-blue)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {submitting ? '決済ページを準備中...' : 'クレジットカードで支払う'}
                </button>
              </div>
            </section>
          </div>
        </section>
      </div>
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
                ? `${formatDateTime(pageData.activeSchedule.opens_at)} - ${formatDateTime(pageData.activeSchedule.closes_at)}`
                : '現在有効な営業枠はありません'}
            </p>
          </div>
          <div className="rounded-3xl border border-[var(--line-soft)] bg-white px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">次回受付予定</p>
            <p className="mt-2 text-sm font-medium text-gray-700">
              {pageData.nextSchedule ? formatDateTime(pageData.nextSchedule.opens_at) : '未定'}
            </p>
          </div>
        </div>
      </section>

      {!pageData.activeSchedule ? (
        <section className="soft-panel rounded-[32px] p-6">
          <h2 className="text-xl font-bold text-[var(--text-main)]">ただいま受付時間外です</h2>
          <p className="mt-3 text-sm leading-7 text-[var(--text-sub)]">
            {pageData.nextSchedule
              ? `次回は ${formatDateTime(pageData.nextSchedule.opens_at)} から受付予定です。営業開始後に同じQRコードからご注文いただけます。`
              : '現在、次回受付予定は未設定です。最新情報は店頭やSNSでご確認ください。'}
          </p>
        </section>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.02fr_0.98fr]">
          <section className="space-y-4">
            {pageData.products.length === 0 ? (
              <div className="soft-panel rounded-[32px] p-6 text-sm text-gray-500">
                公開中の商品はまだありません。しばらくしてからもう一度ご確認ください。
              </div>
            ) : (
              pageData.products.map((product) => (
                (() => {
                  const inventoryBadge = getInventoryBadge(product)
                  const unavailable = isProductUnavailable(product)
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
                        <p className="text-base font-bold text-[var(--accent-blue)]">{formatPrice(product.price)}</p>
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
                      {getInventoryBadge(selectedProduct) && (
                        <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${getInventoryBadge(selectedProduct)?.className}`}>
                          {getInventoryBadge(selectedProduct)?.label}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-sm leading-7 text-[var(--text-sub)]">
                      {selectedProduct.description || '商品の説明は準備中です。'}
                    </p>
                    <p className="mt-4 text-lg font-bold text-[var(--accent-blue)]">{formatPrice(selectedProduct.price)}</p>
                  </div>

                  {isProductUnavailable(selectedProduct) && (
                    <div className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm font-medium text-amber-800">
                      {getUnavailableMessage(selectedProduct)}ため、カートに追加できません。
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
                                    <span className="font-medium">{getChoicePriceLabel(choice)}</span>
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
                        {formatPrice(getCartLineTotal(selectedProduct, selection))}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddToCart}
                    disabled={isProductUnavailable(selectedProduct)}
                    className="w-full rounded-full bg-[var(--accent-blue)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {isProductUnavailable(selectedProduct) ? '売り切れ中です' : 'カートに追加'}
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

              <div className="mt-4 space-y-3">
                {cartItems.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-[var(--line-soft)] bg-white px-4 py-6 text-sm text-gray-500">
                    まだ商品が入っていません。商品を選んでカートに追加してください。
                  </div>
                ) : (
                  cartItems.map((item) => (
                    <div key={item.id} className="rounded-3xl border border-[var(--line-soft)] bg-white px-4 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-800">
                            {item.product_name} x{item.quantity}
                          </p>
                          {item.selected_options.length > 0 && (
                            <div className="mt-2 space-y-1 text-xs text-gray-500">
                              {item.selected_options.map((group) => (
                                <p key={group.group_id}>
                                  {group.group_name}: {group.choices.map((choice) => choice.choice_name).join(' / ')}
                                </p>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeCartItem(item.id)}
                          className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600"
                        >
                          削除
                        </button>
                      </div>
                      <p className="mt-3 text-sm font-bold text-[var(--accent-blue)]">{formatPrice(item.line_total)}</p>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-5 rounded-3xl border border-[var(--line-soft)] bg-white px-4 py-4">
                <label className="mb-2 block text-sm font-medium text-gray-700">受け取りニックネーム</label>
                <input
                  value={pickupNickname}
                  onChange={(event) => {
                    setPickupNickname(event.target.value)
                  }}
                  className="w-full px-4 py-3"
                  placeholder="例: たろう"
                />
                <p className="mt-2 text-xs text-gray-500">商品受け渡し時にスタッフが呼び出す名前です。</p>
              </div>

              <div className="mt-5 rounded-3xl border border-[var(--line-soft)] bg-[#f8fafc] px-4 py-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">カート合計</span>
                  <span className="text-lg font-bold text-[var(--accent-blue)]">{formatPrice(cartTotal)}</span>
                </div>
              </div>

              {checkoutError && (
                <p className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{checkoutError}</p>
              )}

              <button
                type="button"
                onClick={handleStartReview}
                disabled={cartItems.length === 0}
                className="mt-5 w-full rounded-full bg-[var(--accent-blue)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                注文内容を確認する
              </button>

              <div className="mt-4 rounded-3xl border border-dashed border-[var(--line-soft)] bg-white px-4 py-4 text-sm text-gray-500">
                ご注文内容を確認したあと、クレジットカード決済ページへ進みます。
              </div>
            </section>
          </aside>
        </div>
      )}
    </div>
  )
}
