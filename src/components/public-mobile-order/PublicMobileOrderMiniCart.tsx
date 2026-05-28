import { formatPublicOrderPrice } from '@/lib/public-order-display'
import { publicOrderPrimaryCtaClassName } from '@/lib/public-mobile-order-ui'
import type { PublicOrderCartItem } from '@/lib/use-public-order-cart'

type PublicMobileOrderMiniCartProps = {
  cartItems: PublicOrderCartItem[]
  cartTotal: number
  checkoutError: string | null
  onGoToCart: () => void
}

export default function PublicMobileOrderMiniCart({
  cartItems,
  cartTotal,
  checkoutError,
  onGoToCart,
}: PublicMobileOrderMiniCartProps) {
  return (
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
        onClick={onGoToCart}
        disabled={cartItems.length === 0}
        className={`mt-5 w-full ${publicOrderPrimaryCtaClassName}`}
      >
        カートを見る
      </button>

      <div className="mt-4 rounded-3xl border border-dashed border-[var(--line-soft)] bg-white px-4 py-4 text-sm text-gray-500">
        カートページで注文内容を確認したあと、クレジットカード決済ページへ進みます。
      </div>
    </section>
  )
}
