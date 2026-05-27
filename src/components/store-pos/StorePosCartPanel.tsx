import LoadingLine from '@/components/LoadingLine'
import { formatPublicOrderPrice } from '@/lib/public-order-display'
import {
  primaryButtonClassName,
  secondaryButtonClassName,
  type StorePosCartItem,
} from '@/lib/store-pos-ui'

type StorePosCartPanelProps = {
  cartItems: StorePosCartItem[]
  cartTotal: number
  submitError: string | null
  confirmingPage: boolean
  onClearCart: () => void
  onUpdateCartQuantity: (itemId: string, quantity: number) => void
  onOpenConfirmPage: () => void
}

export default function StorePosCartPanel({
  cartItems,
  cartTotal,
  submitError,
  confirmingPage,
  onClearCart,
  onUpdateCartQuantity,
  onOpenConfirmPage,
}: StorePosCartPanelProps) {
  return (
    <>
      <section className="rounded-[36px] border border-[var(--line-soft)] bg-white px-6 py-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black text-[var(--text-main)]">カート</h2>
            <p className="mt-1 text-sm text-[var(--text-sub)]">間違いがないか確認して、そのまま会計へ進めます。</p>
          </div>
          <button
            type="button"
            onClick={onClearCart}
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
                    onClick={() => onUpdateCartQuantity(item.id, item.quantity - 1)}
                    className={secondaryButtonClassName}
                  >
                    −
                  </button>
                  <div className="min-w-[72px] rounded-[20px] bg-white px-4 py-3 text-center text-lg font-black text-[var(--text-main)] ring-1 ring-[var(--line-soft)]">
                    {item.quantity}
                  </div>
                  <button
                    type="button"
                    onClick={() => onUpdateCartQuantity(item.id, item.quantity + 1)}
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
              onClick={onOpenConfirmPage}
              disabled={cartItems.length === 0 || confirmingPage}
              className={primaryButtonClassName}
            >
              {confirmingPage ? '確認ページを開いています...' : '注文を確認する'}
            </button>
          </div>
        </div>
      </section>
    </>
  )
}
