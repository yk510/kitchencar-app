'use client'

import type { MobileOrderProductRow, StoreOrderScheduleRow, VendorMobileOrderManagedProduct } from '@/types/api-payloads'
import {
  formatProductPrice,
  formatSignedQuantity,
  getCategoryLabel,
  getInventoryStatusLabel,
  normalizeDisplayCategory,
} from '@/lib/vendor-mobile-order-products'

type VendorMobileOrderProductListSectionProps = {
  products: VendorMobileOrderManagedProduct[]
  currentSchedule: StoreOrderScheduleRow | null
  selectedProductId: string | null
  storeName: string
  onSelectProduct: (product: MobileOrderProductRow) => void
  onQuickToggle: (product: MobileOrderProductRow, patch: { is_published?: boolean; is_sold_out?: boolean }) => void
}

export function VendorMobileOrderProductListSection({
  products,
  currentSchedule,
  selectedProductId,
  storeName,
  onSelectProduct,
  onQuickToggle,
}: VendorMobileOrderProductListSectionProps) {
  return (
    <section className="soft-panel p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">登録済み商品</h2>
          <p className="mt-1 text-sm text-gray-500">{storeName} の注文ページに表示される商品です。</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{products.length} 件</span>
      </div>

      <div className="mt-5 space-y-3">
        {products.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[var(--line-soft)] bg-white px-5 py-6 text-sm text-gray-500">
            まだ商品がありません。右側のフォームから最初の商品を追加してください。
          </div>
        ) : (
          products.map((product) => {
            const selected = product.id === selectedProductId
            const inventoryStatus = getInventoryStatusLabel(product, Boolean(currentSchedule))

            return (
              <div
                key={product.id}
                className={`rounded-3xl border px-5 py-4 transition ${
                  selected ? 'border-[var(--accent-blue)] bg-[var(--accent-blue-soft)]' : 'border-[var(--line-soft)] bg-white'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <button type="button" onClick={() => onSelectProduct(product)} className="min-w-0 flex-1 text-left">
                    <div className="flex items-start gap-4">
                      <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-[var(--line-soft)] bg-[#f8fafc]">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                        ) : (
                          <span className="text-[11px] text-gray-400">画像なし</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-gray-800">{product.name}</p>
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${inventoryStatus.className}`}>
                            {inventoryStatus.label}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-gray-500">{formatProductPrice(product.price)} / 表示順 {product.sort_order}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                          <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-slate-700 ring-1 ring-[var(--line-soft)]">
                            注文済み {product.current_ordered_quantity}
                          </span>
                          {Boolean(product.is_recommended) && (
                            <span className="rounded-full bg-yellow-100 px-2.5 py-1 font-semibold text-yellow-800">おすすめ</span>
                          )}
                          <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-slate-700 ring-1 ring-[var(--line-soft)]">
                            {getCategoryLabel(normalizeDisplayCategory(product.display_category))}
                          </span>
                          {product.tracks_inventory && currentSchedule && product.current_initial_quantity != null && (
                            <>
                              <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-slate-700 ring-1 ring-[var(--line-soft)]">
                                初期在庫 {product.current_initial_quantity}
                              </span>
                              <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-slate-700 ring-1 ring-[var(--line-soft)]">
                                調整累計 {formatSignedQuantity(product.current_adjustment_total)}
                              </span>
                            </>
                          )}
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm text-gray-500">{product.description || '説明は未設定です。'}</p>
                      </div>
                    </div>
                  </button>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onQuickToggle(product, { is_published: !product.is_published })}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                        product.is_published ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {product.is_published ? '公開中' : '非公開'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onQuickToggle(product, { is_sold_out: !product.is_sold_out })}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                        product.is_sold_out ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {product.is_sold_out ? '売り切れ' : '販売中'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </section>
  )
}
