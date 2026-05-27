import { getPublicOrderInventoryBadge } from '@/lib/public-order-cart'
import { formatPublicOrderPrice } from '@/lib/public-order-display'
import {
  getStorePosCategoryLabel,
  inferStorePosProductCategory,
  type ProductDisplayCategory,
  type ProductFilterKey,
} from '@/lib/store-pos-ui'
import type { PublicMobileOrderProduct } from '@/types/api-payloads'

type StorePosCategorizedProduct = {
  product: PublicMobileOrderProduct
  category: ProductDisplayCategory
  recommended: boolean
}

type StorePosProductGridProps = {
  products: PublicMobileOrderProduct[]
  filteredProducts: PublicMobileOrderProduct[]
  categorizedProducts: StorePosCategorizedProduct[]
  selectedProductId: string | null
  activeFilter: ProductFilterKey
  inventoryRefreshing: boolean
  onFilterChange: (filter: ProductFilterKey) => void
  onSelectProduct: (product: PublicMobileOrderProduct) => void
}

const productFilterKeys: ProductFilterKey[] = ['recommended', 'all', 'main', 'side', 'drink', 'other']

export default function StorePosProductGrid({
  products,
  filteredProducts,
  categorizedProducts,
  selectedProductId,
  activeFilter,
  inventoryRefreshing,
  onFilterChange,
  onSelectProduct,
}: StorePosProductGridProps) {
  return (
    <div className="rounded-[36px] border border-[var(--line-soft)] bg-white px-6 py-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-[var(--text-main)]">商品を選ぶ</h2>
          <p className="mt-1 text-sm text-[var(--text-sub)]">おすすめやカテゴリから商品を選び、右側で数量やトッピングを決められます。</p>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
          {inventoryRefreshing ? '在庫確認中...' : `${filteredProducts.length} / ${products.length} 商品`}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {productFilterKeys.map((filterKey) => {
          const active = activeFilter === filterKey
          return (
            <button
              key={filterKey}
              type="button"
              onClick={() => onFilterChange(filterKey)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                active
                  ? 'bg-[var(--accent-blue)] text-white shadow-[0_10px_24px_rgba(37,99,235,0.24)]'
                  : 'bg-white text-slate-600 ring-1 ring-[var(--line-soft)] hover:bg-slate-50'
              }`}
            >
              {getStorePosCategoryLabel(filterKey)}
            </button>
          )
        })}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {filteredProducts.map((product) => {
          const inventoryBadge = getPublicOrderInventoryBadge(product)
          const active = selectedProductId === product.id
          return (
            <button
              key={product.id}
              type="button"
              onClick={() => onSelectProduct(product)}
              className={`flex h-full flex-col rounded-[30px] border px-5 py-5 text-left shadow-[0_10px_28px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 ${
                active
                  ? 'border-[var(--accent-blue)] bg-[var(--accent-blue-soft)]'
                  : 'border-[var(--line-soft)] bg-[#fcfdff] hover:bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="mb-4 flex h-44 items-center justify-center overflow-hidden rounded-[24px] border border-[var(--line-soft)] bg-[#f8fbff] p-4">
                    {product.image_url ? (
                      <div className="grid h-full w-full place-items-center overflow-hidden rounded-[18px] bg-white">
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="max-h-full max-w-full object-contain object-center"
                        />
                      </div>
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-400">
                        商品画像を準備中です
                      </div>
                    )}
                  </div>
                </div>
                <div className="shrink-0 rounded-full bg-[var(--accent-blue)]/10 px-3 py-1 text-sm font-semibold text-[var(--accent-blue)]">
                  {formatPublicOrderPrice(product.price)}
                </div>
              </div>

              <div className="min-h-[5.25rem]">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="line-clamp-2 min-h-[3.75rem] text-xl font-black leading-[1.85rem] text-[var(--text-main)]">
                    {product.name}
                  </h3>
                  {categorizedProducts.find((entry) => entry.product.id === product.id)?.recommended && (
                    <span className="rounded-full bg-yellow-100 px-3 py-1 text-[11px] font-semibold text-yellow-800">
                      おすすめ
                    </span>
                  )}
                  {inventoryBadge && (
                    <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${inventoryBadge.className}`}>
                      {inventoryBadge.label}
                    </span>
                  )}
                </div>
              </div>

              <div className="min-h-[5.5rem]">
                {product.description ? (
                  <p className="line-clamp-3 text-sm leading-6 text-[var(--text-sub)]">{product.description}</p>
                ) : (
                  <p className="line-clamp-3 text-sm leading-6 text-[var(--text-sub)]">店頭POSの簡易注文です</p>
                )}
              </div>

              <div className="mt-auto flex items-center justify-between gap-3 pt-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-[var(--line-soft)]">
                    {getStorePosCategoryLabel(inferStorePosProductCategory(product))}
                  </span>
                  <span className="text-[var(--text-sub)]">
                    {product.option_groups.length > 0 ? `${product.option_groups.length}個のオプション` : 'オプションなし'}
                  </span>
                </div>
                <span className="font-semibold text-[var(--accent-blue)]">{active ? '選択中' : '詳細を見る'}</span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
