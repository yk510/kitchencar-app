import { getPublicOrderInventoryBadge, isPublicOrderProductUnavailable } from '@/lib/public-order-cart'
import { formatPublicOrderPrice } from '@/lib/public-order-display'
import type { PublicMobileOrderProduct } from '@/types/api-payloads'

type PublicMobileOrderProductListProps = {
  products: PublicMobileOrderProduct[]
  selectedProductId: string | null
  inventoryRefreshing: boolean
  onSelectProduct: (product: PublicMobileOrderProduct) => void
}

export default function PublicMobileOrderProductList({
  products,
  selectedProductId,
  inventoryRefreshing,
  onSelectProduct,
}: PublicMobileOrderProductListProps) {
  return (
    <section className="space-y-4">
      {inventoryRefreshing ? (
        <div className="rounded-3xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-700">
          在庫を確認しています。売り切れや残りわずかの表示をまもなく更新します。
        </div>
      ) : null}
      {products.length === 0 ? (
        <div className="soft-panel rounded-[32px] p-6 text-sm text-gray-500">
          公開中の商品はまだありません。しばらくしてからもう一度ご確認ください。
        </div>
      ) : (
        products.map((product) => {
          const inventoryBadge = getPublicOrderInventoryBadge(product)
          const unavailable = isPublicOrderProductUnavailable(product)
          const selected = selectedProductId === product.id

          return (
            <button
              key={product.id}
              type="button"
              disabled={unavailable}
              onClick={() => onSelectProduct(product)}
              aria-pressed={selected}
              className={`soft-panel w-full rounded-[32px] p-5 text-left transition ${
                selected
                  ? 'border-[var(--accent-blue)] bg-[var(--accent-blue-soft)]/40 ring-2 ring-[var(--accent-blue)] shadow-[0_18px_45px_rgba(37,99,235,0.18)]'
                  : unavailable
                    ? 'opacity-70'
                    : 'hover:translate-y-[-1px] hover:border-[var(--accent-blue-soft)] hover:shadow-md'
              } disabled:cursor-not-allowed`}
            >
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-3xl border bg-[#f8fafc] ${
                    selected ? 'border-[var(--accent-blue)]' : 'border-[var(--line-soft)]'
                  }`}
                >
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs text-gray-400">画像なし</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-gray-800">{product.name}</h2>
                    {selected && (
                      <span className="rounded-full bg-[var(--accent-blue)] px-3 py-1 text-[11px] font-semibold text-white">
                        選択中
                      </span>
                    )}
                    {inventoryBadge && (
                      <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${inventoryBadge.className}`}>
                        {inventoryBadge.label}
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm leading-7 text-gray-500">
                    {product.description || '商品の説明は準備中です。'}
                  </p>
                  {selected && (
                    <p className="mt-3 text-sm font-semibold text-[var(--accent-blue)]">
                      右側でオプションと数量を調整できます
                    </p>
                  )}
                  <div className="mt-4 flex items-center justify-between gap-4">
                    <p className="text-base font-bold text-[var(--accent-blue)]">{formatPublicOrderPrice(product.price)}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      {unavailable && (
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                          現在注文できません
                        </span>
                      )}
                      {product.current_inventory_status === 'low_stock' && (
                        <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-800">
                          売り切れ間近
                        </span>
                      )}
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-[var(--line-soft)]">
                        {product.option_groups.length > 0 ? `${product.option_groups.length}個のオプション` : 'オプションなし'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </button>
          )
        })
      )}
    </section>
  )
}
