import {
  getPublicOrderCartLineTotal,
  getPublicOrderChoicePriceLabel,
  getPublicOrderInventoryBadge,
  isPublicOrderProductUnavailable,
  type PublicOrderProductSelection,
} from '@/lib/public-order-cart'
import { formatPublicOrderPrice } from '@/lib/public-order-display'
import {
  getPublicMobileOrderUnavailableMessage,
  publicOrderPrimaryCtaClassName,
} from '@/lib/public-mobile-order-ui'
import type { PublicMobileOrderProduct } from '@/types/api-payloads'

type PublicMobileOrderProductCustomizerProps = {
  selectedProduct: PublicMobileOrderProduct | null
  selection: PublicOrderProductSelection | null
  selectionError: string | null
  onToggleChoice: (group: PublicMobileOrderProduct['option_groups'][number], choiceId: string) => void
  onUpdateQuantity: (quantity: number) => void
  onAddToCart: () => void
}

export default function PublicMobileOrderProductCustomizer({
  selectedProduct,
  selection,
  selectionError,
  onToggleChoice,
  onUpdateQuantity,
  onAddToCart,
}: PublicMobileOrderProductCustomizerProps) {
  const inventoryBadge = selectedProduct ? getPublicOrderInventoryBadge(selectedProduct) : null

  return (
    <section className="soft-panel rounded-[32px] p-6">
      {selectedProduct && selection ? (
        <div className="space-y-5">
          <div>
            <div className="mb-3 inline-flex rounded-full bg-[var(--accent-blue-soft)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--accent-blue)]">
              選択中の商品
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-[var(--text-main)]">{selectedProduct.name}</h2>
              {inventoryBadge && (
                <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${inventoryBadge.className}`}>
                  {inventoryBadge.label}
                </span>
              )}
            </div>
            <p className="mt-2 text-sm leading-7 text-[var(--text-sub)]">
              {selectedProduct.description || '商品の説明は準備中です。'}
            </p>
            <p className="mt-4 text-lg font-bold text-[var(--accent-blue)]">{formatPublicOrderPrice(selectedProduct.price)}</p>
          </div>

          {isPublicOrderProductUnavailable(selectedProduct) && (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm font-medium text-amber-800">
              {getPublicMobileOrderUnavailableMessage(selectedProduct)}ため、カートに追加できません。
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
                            onClick={() => onToggleChoice(group, choice.id)}
                            className={`flex w-full items-center justify-between rounded-2xl px-3 py-3 text-sm transition ${
                              selected
                                ? 'bg-[var(--accent-blue-soft)] text-[var(--accent-blue)] ring-1 ring-[var(--accent-blue)]'
                                : 'bg-[#f8fafc] text-gray-700'
                            } disabled:cursor-not-allowed disabled:opacity-50`}
                          >
                            <span className={choice.is_active ? '' : 'line-through'}>{choice.name}</span>
                            <span className="font-medium">{getPublicOrderChoicePriceLabel(choice)}</span>
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
                  onClick={() => onUpdateQuantity(selection.quantity - 1)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-lg font-semibold text-slate-700"
                >
                  -
                </button>
                <span className="min-w-8 text-center text-sm font-semibold text-gray-800">{selection.quantity}</span>
                <button
                  type="button"
                  onClick={() => onUpdateQuantity(selection.quantity + 1)}
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
                {formatPublicOrderPrice(getPublicOrderCartLineTotal(selectedProduct, selection))}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onAddToCart}
            disabled={isPublicOrderProductUnavailable(selectedProduct)}
            className={`w-full ${publicOrderPrimaryCtaClassName}`}
          >
            {isPublicOrderProductUnavailable(selectedProduct) ? '売り切れ中です' : 'カートに追加'}
          </button>
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-[var(--line-soft)] bg-white px-5 py-10 text-center text-sm text-gray-500">
          左の商品を選ぶと、オプション内容を確認できます。
        </div>
      )}
    </section>
  )
}
