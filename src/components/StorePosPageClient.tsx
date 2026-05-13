'use client'

import { useEffect, useMemo, useState } from 'react'
import { ApiClientError, fetchApi } from '@/lib/api-client'
import type {
  PublicMobileOrderPagePayload,
  PublicMobileOrderProduct,
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
}

type StorePosCreateResponse = {
  order_id: string
  order_number: string
  payment_status: 'pending' | 'paid'
  payment_method: StorePosPaymentMethod
  total_amount: number
}

const primaryButtonClassName =
  'inline-flex items-center justify-center rounded-[28px] bg-[var(--accent-blue)] px-6 py-4 text-base font-semibold text-white shadow-[0_14px_32px_rgba(37,99,235,0.28)] transition hover:brightness-[1.03] disabled:cursor-not-allowed disabled:opacity-50'
const secondaryButtonClassName =
  'inline-flex items-center justify-center rounded-[28px] bg-white px-6 py-4 text-base font-semibold text-slate-700 ring-1 ring-[var(--line-soft)] transition hover:bg-slate-50'

function formatPrice(value: number) {
  return `${value.toLocaleString()} 円`
}

function buildCartItem(product: PublicMobileOrderProduct): CartItem {
  return {
    id: `${product.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    product_id: product.id,
    product_name: product.name,
    unit_price: product.price,
    quantity: 1,
    line_total: product.price,
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

export default function StorePosPageClient({ data }: { data: PublicMobileOrderPagePayload }) {
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<StorePosPaymentMethod>('cash')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [completedOrder, setCompletedOrder] = useState<StorePosCreateResponse | null>(null)
  const [countdownSeconds, setCountdownSeconds] = useState(12)

  const paymentMethods = useMemo(() => buildDefaultPaymentMethods(data.store), [data.store])
  const cartTotal = useMemo(() => cartItems.reduce((sum, item) => sum + item.line_total, 0), [cartItems])

  useEffect(() => {
    if (!paymentMethods.includes(selectedPaymentMethod)) {
      setSelectedPaymentMethod(paymentMethods[0] ?? 'cash')
    }
  }, [paymentMethods, selectedPaymentMethod])

  useEffect(() => {
    if (!completedOrder) return

    setCountdownSeconds(12)
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
  }, [completedOrder])

  function addProductToCart(product: PublicMobileOrderProduct) {
    setCartItems((current) => {
      const existing = current.find((item) => item.product_id === product.id)
      if (!existing) {
        return [...current, buildCartItem(product)]
      }

      return current.map((item) =>
        item.product_id === product.id
          ? {
              ...item,
              quantity: item.quantity + 1,
              line_total: (item.quantity + 1) * item.unit_price,
            }
          : item
      )
    })
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
    setCompletedOrder(null)
    setCartItems([])
    setSubmitError(null)
    setSelectedPaymentMethod(paymentMethods[0] ?? 'cash')
    setCountdownSeconds(12)
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
          selected_option_choice_ids: [],
        })),
      }

      const response = await fetchApi<StorePosCreateResponse>('/api/public/store-pos/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      setCompletedOrder(response)
    } catch (error) {
      setSubmitError(error instanceof ApiClientError ? error.message : '注文の作成に失敗しました')
    } finally {
      setSubmitting(false)
    }
  }

  if (completedOrder) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef4ff_100%)] px-5 py-8">
        <div className="mx-auto max-w-5xl">
          <section className="rounded-[40px] border border-[var(--line-soft)] bg-white px-8 py-10 shadow-[0_28px_70px_rgba(15,23,42,0.08)]">
            <div className="inline-flex rounded-full bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-700">
              ORDER COMPLETE
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-tight text-[var(--text-main)]">ご注文を受け付けました</h1>
            <p className="mt-4 text-lg leading-8 text-[var(--text-sub)]">
              店員へお支払いください。受付番号を確認したあと、そのまま商品の準備に進みます。
            </p>

            <div className="mt-8 grid gap-5 md:grid-cols-3">
              <div className="rounded-[28px] bg-[#f8fbff] px-6 py-6 ring-1 ring-[var(--line-soft)]">
                <p className="text-sm font-semibold text-gray-500">受付番号</p>
                <p className="mt-3 text-3xl font-black tracking-[0.08em] text-[var(--accent-blue)]">
                  {completedOrder.order_number}
                </p>
              </div>
              <div className="rounded-[28px] bg-[#f8fbff] px-6 py-6 ring-1 ring-[var(--line-soft)]">
                <p className="text-sm font-semibold text-gray-500">支払方法</p>
                <p className="mt-3 text-2xl font-black text-[var(--text-main)]">
                  {completedOrder.payment_method === 'cash'
                    ? '現金'
                    : completedOrder.payment_method === 'paypay'
                      ? 'PayPay'
                      : 'その他'}
                </p>
              </div>
              <div className="rounded-[28px] bg-[#f8fbff] px-6 py-6 ring-1 ring-[var(--line-soft)]">
                <p className="text-sm font-semibold text-gray-500">合計金額</p>
                <p className="mt-3 text-2xl font-black text-[var(--text-main)]">{formatPrice(completedOrder.total_amount)}</p>
              </div>
            </div>

            <div className="mt-8 rounded-[28px] border border-dashed border-[var(--line-soft)] bg-[#fffdf7] px-5 py-4 text-sm text-amber-700">
              まもなく次の注文画面へ戻ります。あと {countdownSeconds} 秒
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
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#eef4ff_100%)] px-5 py-6">
      <div className="mx-auto max-w-7xl space-y-6">
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
                商品を選んで、お支払い方法を決めるだけで注文できます。店員へお支払いください。
              </p>
            </div>
            <div className="rounded-[24px] bg-[#f8fbff] px-5 py-4 ring-1 ring-[var(--line-soft)]">
              <p className="text-sm font-semibold text-gray-500">現在の合計</p>
              <p className="mt-2 text-3xl font-black text-[var(--accent-blue)]">{formatPrice(cartTotal)}</p>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[36px] border border-[var(--line-soft)] bg-white px-6 py-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-[var(--text-main)]">商品を選ぶ</h2>
                <p className="mt-1 text-sm text-[var(--text-sub)]">大きなボタンで、人数を問わず押しやすくしています。</p>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
                {data.products.length} 商品
              </div>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {data.products.map((product) => (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => addProductToCart(product)}
                  className="rounded-[30px] border border-[var(--line-soft)] bg-[#fcfdff] px-5 py-5 text-left shadow-[0_10px_28px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:bg-white"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-black text-[var(--text-main)]">{product.name}</h3>
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
                  <div className="mt-5 inline-flex rounded-full bg-[var(--accent-blue)] px-4 py-2 text-sm font-semibold text-white">
                    カートに追加
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <section className="rounded-[36px] border border-[var(--line-soft)] bg-white px-6 py-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
              <h2 className="text-2xl font-black text-[var(--text-main)]">カート</h2>
              <p className="mt-1 text-sm text-[var(--text-sub)]">内容を確認しながら、そのまま会計へ進めます。</p>

              <div className="mt-5 space-y-3">
                {cartItems.length === 0 ? (
                  <div className="rounded-[28px] border border-dashed border-[var(--line-soft)] bg-[#fbfdff] px-5 py-8 text-center text-sm text-[var(--text-sub)]">
                    まだ商品が入っていません。左側の商品をタップしてください。
                  </div>
                ) : (
                  cartItems.map((item) => (
                    <div key={item.id} className="rounded-[28px] bg-[#fbfdff] px-5 py-4 ring-1 ring-[var(--line-soft)]">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-lg font-bold text-[var(--text-main)]">{item.product_name}</p>
                          <p className="mt-1 text-sm text-[var(--text-sub)]">{formatPrice(item.unit_price)} / 1点</p>
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
      </div>
    </div>
  )
}
