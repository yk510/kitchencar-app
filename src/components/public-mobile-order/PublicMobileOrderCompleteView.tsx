import { formatPublicOrderPrice } from '@/lib/public-order-display'
import { publicOrderPrimaryCtaClassName } from '@/lib/public-mobile-order-ui'
import type { PublicMobileOrderCheckoutStatusResponse } from '@/types/api-payloads'

type PublicMobileOrderCompleteViewProps = {
  completedOrder: PublicMobileOrderCheckoutStatusResponse
  onResetToOrderPage: () => void
}

export default function PublicMobileOrderCompleteView({
  completedOrder,
  onResetToOrderPage,
}: PublicMobileOrderCompleteViewProps) {
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
          <p className="mt-2 text-sm text-gray-600">合計: {formatPublicOrderPrice(completedOrder.total_amount)}</p>
        </div>

        <button
          type="button"
          onClick={onResetToOrderPage}
          className={`mt-6 ${publicOrderPrimaryCtaClassName}`}
        >
          もう一度注文ページを見る
        </button>
      </section>
    </div>
  )
}
