import {
  getPublicOrderCartLineTotal,
  getPublicOrderChoicePriceLabel,
  getPublicOrderInventoryBadge,
  isPublicOrderProductUnavailable,
  type PublicOrderProductSelection,
} from '@/lib/public-order-cart'
import { formatPublicOrderPrice } from '@/lib/public-order-display'
import {
  getStorePosUnavailableMessage,
  primaryButtonClassName,
  secondaryButtonClassName,
} from '@/lib/store-pos-ui'
import type { PublicMobileOrderProduct } from '@/types/api-payloads'

type StorePosProductCustomizerProps = {
  selectedProduct: PublicMobileOrderProduct | null
  selection: PublicOrderProductSelection | null
  isRecommended: boolean
  selectionError: string | null
  onToggleChoice: (group: PublicMobileOrderProduct['option_groups'][number], choiceId: string) => void
  onUpdateQuantity: (quantity: number) => void
  onAddSelectedProduct: () => void
}

export default function StorePosProductCustomizer({
  selectedProduct,
  selection,
  isRecommended,
  selectionError,
  onToggleChoice,
  onUpdateQuantity,
  onAddSelectedProduct,
}: StorePosProductCustomizerProps) {
  return (
    <section className="rounded-[36px] border border-[var(--line-soft)] bg-white px-6 py-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
      <h2 className="text-2xl font-black text-[var(--text-main)]">オプションと数量</h2>
      <p className="mt-1 text-sm text-[var(--text-sub)]">右側で内容を確認してからカートに追加します。</p>

      <div className="mt-5">
        {!selectedProduct || !selection ? (
          <div className="rounded-[28px] border border-dashed border-[var(--line-soft)] bg-[#fbfdff] px-5 py-8 text-center text-sm text-[var(--text-sub)]">
            左側の商品をタップしてください。
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-[28px] bg-[#fbfdff] px-5 py-5 ring-1 ring-[var(--line-soft)]">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="mb-4 flex h-52 items-center justify-center overflow-hidden rounded-[24px] border border-[var(--line-soft)] bg-white p-4">
                    {selectedProduct.image_url ? (
                      <div className="grid h-full w-full place-items-center overflow-hidden rounded-[18px] bg-[#f8fbff]">
                        <img
                          src={selectedProduct.image_url}
                          alt={selectedProduct.name}
                          className="max-h-full max-w-full object-contain object-center"
                        />
                      </div>
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-400">
                        商品画像を準備中です
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-black text-[var(--text-main)]">{selectedProduct.name}</h3>
                    {isRecommended && (
                      <span className="rounded-full bg-yellow-100 px-3 py-1 text-[11px] font-semibold text-yellow-800">
                        おすすめ
                      </span>
                    )}
                    {getPublicOrderInventoryBadge(selectedProduct) && (
                      <span
                        className={`rounded-full px-3 py-1 text-[11px] font-semibold ${getPublicOrderInventoryBadge(selectedProduct)?.className}`}
                      >
                        {getPublicOrderInventoryBadge(selectedProduct)?.label}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-sub)]">{selectedProduct.description || '商品の説明は準備中です。'}</p>
                </div>
                <div className="rounded-full bg-[var(--accent-blue)]/10 px-3 py-1 text-sm font-semibold text-[var(--accent-blue)]">
                  {formatPublicOrderPrice(selectedProduct.price)}
                </div>
              </div>
            </div>

            {isPublicOrderProductUnavailable(selectedProduct) && (
              <div className="rounded-[24px] bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {getStorePosUnavailableMessage(selectedProduct)}
              </div>
            )}

            {selectedProduct.option_groups.length === 0 ? (
              <div className="rounded-[28px] border border-dashed border-[var(--line-soft)] bg-[#fbfdff] px-5 py-5 text-sm text-[var(--text-sub)]">
                この商品にはオプションがありません。
              </div>
            ) : (
              selectedProduct.option_groups.map((group) => {
                const selectedIds = selection.selectedChoiceIdsByGroup[group.id] ?? []
                return (
                  <div key={group.id} className="rounded-[28px] bg-[#fbfdff] px-5 py-5 ring-1 ring-[var(--line-soft)]">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-base font-bold text-[var(--text-main)]">{group.name}</h4>
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
                            className={`flex w-full items-center justify-between rounded-[22px] px-4 py-3 text-left text-sm transition ${
                              selected
                                ? 'bg-[var(--accent-blue-soft)] text-[var(--accent-blue)] ring-1 ring-[var(--accent-blue)]'
                                : 'bg-white text-slate-700 ring-1 ring-[var(--line-soft)] hover:bg-slate-50'
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

            <div className="rounded-[28px] bg-[#fbfdff] px-5 py-5 ring-1 ring-[var(--line-soft)]">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-semibold text-gray-500">数量</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => onUpdateQuantity(selection.quantity - 1)}
                    className={secondaryButtonClassName}
                  >
                    −
                  </button>
                  <div className="min-w-[72px] rounded-[20px] bg-white px-4 py-3 text-center text-lg font-black text-[var(--text-main)] ring-1 ring-[var(--line-soft)]">
                    {selection.quantity}
                  </div>
                  <button
                    type="button"
                    onClick={() => onUpdateQuantity(selection.quantity + 1)}
                    className={secondaryButtonClassName}
                  >
                    ＋
                  </button>
                </div>
              </div>
            </div>

            {selectionError && (
              <div className="rounded-[24px] bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {selectionError}
              </div>
            )}

            <div className="rounded-[28px] bg-[#f8fbff] px-5 py-5 ring-1 ring-[var(--line-soft)]">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-gray-500">この商品の合計</p>
                  <p className="mt-2 text-2xl font-black text-[var(--text-main)]">
                    {formatPublicOrderPrice(getPublicOrderCartLineTotal(selectedProduct, selection))}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onAddSelectedProduct}
                  disabled={isPublicOrderProductUnavailable(selectedProduct)}
                  className={primaryButtonClassName}
                >
                  {isPublicOrderProductUnavailable(selectedProduct) ? '売り切れ中です' : 'カートに追加'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
