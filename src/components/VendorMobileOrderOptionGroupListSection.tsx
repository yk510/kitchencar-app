import type {
  MobileOrderProductRow,
  VendorMobileOrderOptionGroup,
} from '@/types/api-payloads'
import { getLinkedProductNames } from '@/lib/vendor-mobile-order-options'

type Props = {
  storeName: string
  products: MobileOrderProductRow[]
  optionGroups: VendorMobileOrderOptionGroup[]
  selectedGroupId: string | null
  onSelectGroup: (group: VendorMobileOrderOptionGroup) => void
}

export default function VendorMobileOrderOptionGroupListSection({
  storeName,
  products,
  optionGroups,
  selectedGroupId,
  onSelectGroup,
}: Props) {
  return (
    <section className="soft-panel p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">登録済みオプション</h2>
          <p className="mt-1 text-sm text-gray-500">{storeName} で使うオプショングループ一覧です。</p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
          {optionGroups.length} 件
        </span>
      </div>

      <div className="mt-5 space-y-3">
        {optionGroups.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-[var(--line-soft)] bg-white px-5 py-6 text-sm text-gray-500">
            まだオプションがありません。右側のフォームから最初のグループを追加してください。
          </div>
        ) : (
          optionGroups.map((group) => {
            const selected = group.id === selectedGroupId
            const linkedProductsLabel = getLinkedProductNames(products, group.linked_product_ids)

            return (
              <button
                key={group.id}
                type="button"
                onClick={() => onSelectGroup(group)}
                className={`w-full rounded-3xl border px-5 py-4 text-left transition ${
                  selected
                    ? 'border-[var(--accent-blue)] bg-[var(--accent-blue-soft)]'
                    : 'border-[var(--line-soft)] bg-white'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800">{group.name}</p>
                    <p className="mt-1 text-sm text-gray-500">
                      {group.selection_type === 'single' ? '単一選択' : '複数選択'} /{' '}
                      {group.is_required ? '必須' : '任意'}
                    </p>
                    <p className="mt-2 text-sm text-gray-500">
                      選択肢 {group.choices.map((choice) => choice.name).join(' / ') || '未設定'}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      対象商品: {linkedProductsLabel || 'まだ紐付けなし'}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    表示順 {group.sort_order}
                  </span>
                </div>
              </button>
            )
          })
        )}
      </div>
    </section>
  )
}
