import LoadingLine from '@/components/LoadingLine'
import PublicOrderItemsPanel from '@/components/PublicOrderItemsPanel'
import { formatPublicOrderPrice, formatStorePosPaymentMethodLabel } from '@/lib/public-order-display'
import {
  primaryButtonClassName,
  type StorePosCartItem,
  type SubmittedStorePosOrder,
} from '@/lib/store-pos-ui'

type StorePosSubmittedViewProps = {
  submittedOrder: SubmittedStorePosOrder
  cartItems: StorePosCartItem[]
  totalItems: number
  countdownSeconds: number
  settlementMessage: string | null
  isPrintingReceipt: boolean
  isSettlementComplete: boolean
  waitingSettlement: boolean
  resettingToMenu: boolean
  onResetForNextCustomer: () => void
}

export default function StorePosSubmittedView({
  submittedOrder,
  cartItems,
  totalItems,
  countdownSeconds,
  settlementMessage,
  isPrintingReceipt,
  isSettlementComplete,
  waitingSettlement,
  resettingToMenu,
  onResetForNextCustomer,
}: StorePosSubmittedViewProps) {
  const isCancelled = submittedOrder.status === 'cancelled'
  const isSettled = isSettlementComplete || isCancelled

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
            {isSettled ? ` あと ${countdownSeconds} 秒` : isPrintingReceipt ? ' レシート印刷中です。' : waitingSettlement ? ' 店員側の処理を確認中です。' : ''}
          </div>

          {resettingToMenu ? (
            <div className="mt-4 rounded-[24px] bg-[var(--accent-blue-soft)] px-4 py-4">
              <LoadingLine label="次の注文画面へ戻っています..." />
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" onClick={onResetForNextCustomer} className={primaryButtonClassName}>
              次の注文を始める
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
