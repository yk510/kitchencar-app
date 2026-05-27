import LoadingLine from '@/components/LoadingLine'
import PublicOrderItemsPanel from '@/components/PublicOrderItemsPanel'
import { formatPublicOrderPrice, formatStorePosPaymentMethodLabel } from '@/lib/public-order-display'
import type { StorePosCartItem } from '@/lib/store-pos-ui'
import type { StorePosPaymentMethod } from '@/types/api-payloads'

type StorePosConfirmViewProps = {
  cartItems: StorePosCartItem[]
  totalItems: number
  cartTotal: number
  paymentMethods: StorePosPaymentMethod[]
  selectedPaymentMethod: StorePosPaymentMethod
  submitError: string | null
  submitting: boolean
  onPaymentMethodChange: (method: StorePosPaymentMethod) => void
  onReturnToProductSelection: () => void
  onSubmitOrder: () => void
}

export default function StorePosConfirmView({
  cartItems,
  totalItems,
  cartTotal,
  paymentMethods,
  selectedPaymentMethod,
  submitError,
  submitting,
  onPaymentMethodChange,
  onReturnToProductSelection,
  onSubmitOrder,
}: StorePosConfirmViewProps) {
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
                  onClick={() => onPaymentMethodChange(method)}
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
              onClick={onReturnToProductSelection}
              className="inline-flex items-center justify-center rounded-[24px] bg-white px-5 py-4 text-base font-semibold text-slate-600 ring-1 ring-[var(--line-soft)] transition hover:bg-slate-50"
            >
              商品選択に戻る
            </button>
            <button
              type="button"
              onClick={onSubmitOrder}
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
