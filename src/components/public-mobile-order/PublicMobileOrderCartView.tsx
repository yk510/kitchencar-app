import LoadingLine from '@/components/LoadingLine'
import { formatPublicOrderPrice } from '@/lib/public-order-display'
import {
  publicOrderPrimaryCtaClassName,
  publicOrderSecondaryCtaClassName,
} from '@/lib/public-mobile-order-ui'
import type { PublicOrderCartItem } from '@/lib/use-public-order-cart'

type PublicMobileOrderCartViewProps = {
  cartItems: PublicOrderCartItem[]
  pickupNickname: string
  cartTotal: number
  checkoutError: string | null
  transitioningStep: 'cart' | 'review' | null
  onPickupNicknameChange: (value: string) => void
  onRemoveCartItem: (itemId: string) => void
  onBackToMenu: () => void
  onStartReview: () => void
}

export default function PublicMobileOrderCartView({
  cartItems,
  pickupNickname,
  cartTotal,
  checkoutError,
  transitioningStep,
  onPickupNicknameChange,
  onRemoveCartItem,
  onBackToMenu,
  onStartReview,
}: PublicMobileOrderCartViewProps) {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 lg:px-6">
      <section className="soft-panel rounded-[36px] px-6 py-7 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="badge-soft badge-blue inline-block">CART</div>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-[var(--text-main)]">カートの確認</h1>
            <p className="mt-3 text-sm leading-7 text-[var(--text-sub)]">
              商品内容と受け取り名を確認してから、注文内容の確認へ進みます。
            </p>
          </div>
          <button
            type="button"
            onClick={onBackToMenu}
            className={publicOrderSecondaryCtaClassName}
          >
            商品選択へ戻る
          </button>
        </div>
      </section>

      {transitioningStep === 'cart' ? (
        <section className="soft-panel rounded-[28px] px-5 py-4 lg:px-6">
          <LoadingLine label="カート確認ページを開いています..." />
        </section>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="soft-panel rounded-[32px] p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--text-main)]">ご注文内容</h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {cartItems.length} 件
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {cartItems.map((item) => (
              <div key={`cart-page-${item.id}`} className="rounded-3xl border border-[var(--line-soft)] bg-white px-4 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800">
                      {item.product_name} x{item.quantity}
                    </p>
                    {item.selected_options.length > 0 && (
                      <div className="mt-2 space-y-1 text-xs text-gray-500">
                        {item.selected_options.map((group) => (
                          <p key={`cart-page-${item.id}-${group.group_id}`}>
                            {group.group_name}: {group.choices.map((choice) => choice.choice_name).join(' / ')}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveCartItem(item.id)}
                    className="rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600"
                  >
                    削除
                  </button>
                </div>
                <p className="mt-3 text-sm font-bold text-[var(--accent-blue)]">{formatPublicOrderPrice(item.line_total)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <section className="soft-panel rounded-[32px] p-6">
            <h2 className="text-lg font-semibold text-[var(--text-main)]">お受け取り情報</h2>
            <div className="mt-4 rounded-3xl border border-[var(--line-soft)] bg-white px-4 py-4">
              <label className="mb-2 block text-sm font-medium text-gray-700">受け取りニックネーム</label>
              <input
                value={pickupNickname}
                onChange={(event) => {
                  onPickupNicknameChange(event.target.value)
                }}
                className="w-full px-4 py-3"
                placeholder="例: たろう"
              />
              <p className="mt-2 text-xs text-gray-500">商品受け渡し時にスタッフが呼び出す名前です。</p>
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
              onClick={onStartReview}
              disabled={cartItems.length === 0}
              className={`mt-5 w-full ${publicOrderPrimaryCtaClassName}`}
            >
              注文内容を確認する
            </button>
          </section>
        </div>
      </section>
    </div>
  )
}
