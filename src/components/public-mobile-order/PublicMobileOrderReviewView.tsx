import LoadingLine from '@/components/LoadingLine'
import PublicOrderItemsPanel from '@/components/PublicOrderItemsPanel'
import { formatPublicOrderPrice } from '@/lib/public-order-display'
import {
  publicOrderPrimaryCtaClassName,
  publicOrderSecondaryCtaClassName,
} from '@/lib/public-mobile-order-ui'
import type { PublicOrderCartItem } from '@/lib/use-public-order-cart'

type PublicMobileOrderReviewViewProps = {
  cartItems: PublicOrderCartItem[]
  pickupNickname: string
  cartTotal: number
  checkoutError: string | null
  submitting: boolean
  transitioningStep: 'cart' | 'review' | null
  showPaymentConfirmModal: boolean
  onEditOrder: () => void
  onOpenPaymentConfirm: () => void
  onClosePaymentConfirm: () => void
  onConfirmPaymentSubmit: () => void
}

export default function PublicMobileOrderReviewView({
  cartItems,
  pickupNickname,
  cartTotal,
  checkoutError,
  submitting,
  transitioningStep,
  showPaymentConfirmModal,
  onEditOrder,
  onOpenPaymentConfirm,
  onClosePaymentConfirm,
  onConfirmPaymentSubmit,
}: PublicMobileOrderReviewViewProps) {
  return (
    <>
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
              onClick={onEditOrder}
              className={publicOrderSecondaryCtaClassName}
            >
              内容を修正する
            </button>
          </div>
        </section>

        {transitioningStep === 'review' ? (
          <section className="soft-panel rounded-[28px] px-5 py-4 lg:px-6">
            <LoadingLine label="注文内容の確認ページを開いています..." />
          </section>
        ) : null}

        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <PublicOrderItemsPanel
            title="ご注文内容"
            items={cartItems}
            itemKeyPrefix="review-page"
            panelClassName="soft-panel rounded-[32px] p-6"
            itemClassName="rounded-2xl bg-white px-4 py-4 ring-1 ring-[var(--line-soft)]"
            titleClassName="text-lg font-semibold text-[var(--text-main)]"
            amountClassName="mt-2 text-sm font-bold text-[var(--accent-blue)]"
            metaClassName="mt-1 text-sm text-[var(--text-sub)]"
            optionsClassName="mt-2 space-y-1 text-xs text-gray-500"
          />

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
                  <span className="ml-2 font-semibold text-[var(--accent-blue)]">{formatPublicOrderPrice(cartTotal)}</span>
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

              {submitting ? <LoadingLine className="mt-5" label="決済ページを準備しています..." /> : null}

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={onEditOrder}
                  className={`flex-1 ${publicOrderSecondaryCtaClassName}`}
                >
                  内容を修正する
                </button>
                <button
                  type="button"
                  onClick={onOpenPaymentConfirm}
                  disabled={submitting}
                  className={`flex-1 ${publicOrderPrimaryCtaClassName}`}
                >
                  {submitting ? '決済ページを準備中...' : 'クレジットカードで支払う'}
                </button>
              </div>
            </section>
          </div>
        </section>
      </div>
      {showPaymentConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4">
          <div className="w-full max-w-md rounded-[32px] bg-white p-6 shadow-[0_30px_80px_rgba(15,23,42,0.28)]">
            <div className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-800">
              Payment Notice
            </div>
            <h2 className="mt-4 text-2xl font-black tracking-tight text-[var(--text-main)]">
              お支払い前のご確認
            </h2>
            <p className="mt-4 text-sm leading-7 text-[var(--text-sub)]">
              お支払い完了後のキャンセル・返金はいたしかねます。
              <br />
              ご注文内容を十分にご確認のうえ、お支払い画面へお進みください。
            </p>

            <div className="mt-5 rounded-3xl border border-[var(--line-soft)] bg-[#f8fafc] px-4 py-4 text-sm text-gray-600">
              <p className="font-semibold text-gray-800">今回のお支払い内容</p>
              <p className="mt-2">注文点数: {cartItems.length} 件</p>
              <p className="mt-1">
                お支払い金額:
                <span className="ml-2 font-bold text-[var(--accent-blue)]">{formatPublicOrderPrice(cartTotal)}</span>
              </p>
              <p className="mt-1">受け取り名: {pickupNickname.trim()}</p>
            </div>

            <PublicOrderItemsPanel
              title="注文内容"
              items={cartItems}
              itemKeyPrefix="payment-confirm"
              panelClassName="mt-4 rounded-3xl border border-[var(--line-soft)] bg-white px-4 py-4"
              itemClassName="rounded-2xl bg-[#f8fafc] px-3 py-3 text-sm text-gray-600"
              titleClassName="text-sm font-semibold text-gray-800"
              amountClassName="shrink-0 font-bold text-[var(--accent-blue)]"
              metaClassName="mt-1 text-sm text-[var(--text-sub)]"
              optionsClassName="mt-2 space-y-1 text-xs leading-6 text-gray-500"
            />

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={onClosePaymentConfirm}
                className={`flex-1 ${publicOrderSecondaryCtaClassName}`}
              >
                戻る
              </button>
              <button
                type="button"
                onClick={onConfirmPaymentSubmit}
                disabled={submitting}
                className={`flex-1 ${publicOrderPrimaryCtaClassName}`}
              >
                {submitting ? '決済ページを準備中...' : '支払いへ進む'}
              </button>
            </div>

            {submitting ? <LoadingLine className="mt-4" label="決済ページへ移動しています..." /> : null}
          </div>
        </div>
      )}
    </>
  )
}
