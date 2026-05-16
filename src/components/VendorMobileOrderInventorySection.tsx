'use client'

import type { StoreOrderScheduleRow, VendorMobileOrderManagedProduct } from '@/types/api-payloads'
import { formatProductDateTime, formatSignedQuantity } from '@/lib/vendor-mobile-order-products'

type VendorMobileOrderInventorySectionProps = {
  product: VendorMobileOrderManagedProduct | null
  currentSchedule: StoreOrderScheduleRow | null
  inventoryPending: boolean
  initialInventoryQuantity: string
  adjustmentQuantity: string
  adjustmentReason: string
  onInitialInventoryQuantityChange: (value: string) => void
  onAdjustmentQuantityChange: (value: string) => void
  onAdjustmentReasonChange: (value: string) => void
  onSetInitialInventory: (event: React.FormEvent) => void
  onAddInventoryAdjustment: (event: React.FormEvent) => void
}

export function VendorMobileOrderInventorySection({
  product,
  currentSchedule,
  inventoryPending,
  initialInventoryQuantity,
  adjustmentQuantity,
  adjustmentReason,
  onInitialInventoryQuantityChange,
  onAdjustmentQuantityChange,
  onAdjustmentReasonChange,
  onSetInitialInventory,
  onAddInventoryAdjustment,
}: VendorMobileOrderInventorySectionProps) {
  if (!product?.tracks_inventory) {
    return null
  }

  return (
    <div className="soft-panel p-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">営業中の在庫台帳</h2>
        <p className="mt-1 text-sm text-gray-500">
          初期在庫は一度設定すると固定されます。補充やロスは差分で記録して、後から変化が追えるようにします。
        </p>
      </div>

      {!currentSchedule ? (
        <div className="mt-5 rounded-3xl border border-dashed border-[var(--line-soft)] bg-white px-5 py-5 text-sm text-gray-500">
          受付中の営業枠がないため、在庫台帳はまだ表示できません。営業枠を開始したあとに初期在庫を設定してください。
        </div>
      ) : product.current_initial_quantity == null ? (
        <form onSubmit={onSetInitialInventory} className="mt-5 rounded-3xl border border-[var(--line-soft)] bg-white p-5">
          <p className="text-sm font-semibold text-gray-800">この営業枠の初期在庫を設定する</p>
          <p className="mt-2 text-xs leading-6 text-gray-500">
            {formatProductDateTime(currentSchedule.opens_at)} - {formatProductDateTime(currentSchedule.closes_at)} の初期在庫です。設定後は直接変更できません。
          </p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div className="min-w-[180px] flex-1">
              <label className="mb-2 block text-sm font-medium text-gray-700">初期在庫数</label>
              <input
                type="number"
                min="0"
                step="1"
                value={initialInventoryQuantity}
                onChange={(event) => onInitialInventoryQuantityChange(event.target.value)}
                className="w-full px-4 py-3"
                placeholder="例: 30"
              />
            </div>
            <button
              type="submit"
              disabled={inventoryPending}
              className="rounded-full bg-[var(--accent-blue)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {inventoryPending ? '設定中...' : '初期在庫を固定する'}
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-5 space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-3xl border border-[var(--line-soft)] bg-white px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">初期在庫</p>
              <p className="mt-2 text-xl font-bold text-gray-800">{product.current_initial_quantity}</p>
            </div>
            <div className="rounded-3xl border border-[var(--line-soft)] bg-white px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">調整累計</p>
              <p className="mt-2 text-xl font-bold text-gray-800">{formatSignedQuantity(product.current_adjustment_total)}</p>
            </div>
            <div className="rounded-3xl border border-[var(--line-soft)] bg-white px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">注文数</p>
              <p className="mt-2 text-xl font-bold text-gray-800">{product.current_ordered_quantity}</p>
            </div>
            <div className="rounded-3xl border border-[var(--line-soft)] bg-white px-4 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">現在残数</p>
              <p className="mt-2 text-xl font-bold text-gray-800">{product.current_remaining_quantity ?? '-'}</p>
            </div>
          </div>

          <form onSubmit={onAddInventoryAdjustment} className="rounded-3xl border border-[var(--line-soft)] bg-white p-5">
            <p className="text-sm font-semibold text-gray-800">在庫を調整する</p>
            <p className="mt-2 text-xs leading-6 text-gray-500">
              補充は正の数、ロスや廃棄は負の数で入力します。初期在庫は動かさず、差分だけ積み上げます。
            </p>
            <div className="mt-4 grid gap-4 md:grid-cols-[0.38fr_0.62fr]">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">調整数</label>
                <input
                  type="number"
                  step="1"
                  value={adjustmentQuantity}
                  onChange={(event) => onAdjustmentQuantityChange(event.target.value)}
                  className="w-full px-4 py-3"
                  placeholder="例: +5 / -2"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">理由メモ</label>
                <input
                  value={adjustmentReason}
                  onChange={(event) => onAdjustmentReasonChange(event.target.value)}
                  className="w-full px-4 py-3"
                  placeholder="例: 追加仕込み / 廃棄 / 現物調整"
                />
              </div>
            </div>
            <div className="mt-4">
              <button
                type="submit"
                disabled={inventoryPending}
                className="rounded-full bg-[var(--accent-blue)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                {inventoryPending ? '記録中...' : '差分を記録する'}
              </button>
            </div>
          </form>

          <div className="rounded-3xl border border-[var(--line-soft)] bg-white p-5">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-gray-800">調整履歴</h3>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {product.current_inventory_adjustments.length} 件
              </span>
            </div>
            {product.current_inventory_adjustments.length === 0 ? (
              <p className="mt-4 text-sm text-gray-500">まだ差分調整はありません。</p>
            ) : (
              <div className="mt-4 space-y-3">
                {product.current_inventory_adjustments.map((adjustment) => (
                  <div
                    key={adjustment.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--line-soft)] bg-[#fafafa] px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{formatSignedQuantity(adjustment.adjustment_quantity)}</p>
                      <p className="mt-1 text-xs text-gray-500">{adjustment.reason || '理由メモなし'}</p>
                    </div>
                    <p className="text-xs text-gray-500">{formatProductDateTime(adjustment.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
