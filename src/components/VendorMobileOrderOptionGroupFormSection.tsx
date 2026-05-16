import type { OptionGroupForm } from '@/lib/vendor-mobile-order-options'
import type { MobileOrderProductRow } from '@/types/api-payloads'
import VendorMobileOrderOptionGroupChoicesSection from '@/components/VendorMobileOrderOptionGroupChoicesSection'
import VendorMobileOrderOptionGroupProductsSection from '@/components/VendorMobileOrderOptionGroupProductsSection'

type Props = {
  selectedGroupName: string | null
  form: OptionGroupForm
  pending: boolean
  products: MobileOrderProductRow[]
  onChangeForm: (updater: (prev: OptionGroupForm) => OptionGroupForm) => void
  onSubmit: (event: React.FormEvent) => void
  onAddChoice: () => void
  onUpdateChoice: (index: number, patch: Partial<OptionGroupForm['choices'][number]>) => void
  onRemoveChoice: (index: number) => void
  onToggleLinkedProduct: (productId: string) => void
  onStartCreateMode: () => void
}

export default function VendorMobileOrderOptionGroupFormSection({
  selectedGroupName,
  form,
  pending,
  products,
  onChangeForm,
  onSubmit,
  onAddChoice,
  onUpdateChoice,
  onRemoveChoice,
  onToggleLinkedProduct,
  onStartCreateMode,
}: Props) {
  const isEditing = Boolean(selectedGroupName)

  return (
    <section className="soft-panel p-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">
          {isEditing ? 'オプションを編集' : 'オプションを追加'}
        </h2>
        <p className="mt-1 text-sm text-gray-500">
          {isEditing ? '選択肢や対象商品をまとめて更新できます。' : '作成後すぐに商品へ紐付けできます。'}
        </p>
      </div>

      <form onSubmit={onSubmit} className="mt-5 space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">グループ名</label>
            <input
              value={form.name}
              onChange={(event) => onChangeForm((prev) => ({ ...prev, name: event.target.value }))}
              className="w-full px-4 py-3"
              placeholder="例: トッピング"
              required
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">表示順</label>
            <input
              type="number"
              min="0"
              step="1"
              value={form.sort_order}
              onChange={(event) => onChangeForm((prev) => ({ ...prev, sort_order: event.target.value }))}
              className="w-full px-4 py-3"
              required
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">選択方式</label>
            <select
              value={form.selection_type}
              onChange={(event) =>
                onChangeForm((prev) => ({
                  ...prev,
                  selection_type: event.target.value as 'single' | 'multiple',
                }))
              }
              className="w-full px-4 py-3"
            >
              <option value="single">単一選択</option>
              <option value="multiple">複数選択</option>
            </select>
          </div>
          <div className="rounded-2xl border border-[var(--line-soft)] bg-white px-4 py-3">
            <label className="text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.is_required}
                onChange={(event) =>
                  onChangeForm((prev) => ({ ...prev, is_required: event.target.checked }))
                }
                className="mr-2"
              />
              このオプションを必須にする
            </label>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">最小選択数</label>
            <input
              type="number"
              min="0"
              step="1"
              value={form.min_select}
              onChange={(event) => onChangeForm((prev) => ({ ...prev, min_select: event.target.value }))}
              className="w-full px-4 py-3"
              placeholder="未設定"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">最大選択数</label>
            <input
              type="number"
              min="0"
              step="1"
              value={form.max_select}
              onChange={(event) => onChangeForm((prev) => ({ ...prev, max_select: event.target.value }))}
              className="w-full px-4 py-3"
              placeholder="未設定"
            />
          </div>
        </div>

        <VendorMobileOrderOptionGroupChoicesSection
          choices={form.choices}
          onAddChoice={onAddChoice}
          onUpdateChoice={onUpdateChoice}
          onRemoveChoice={onRemoveChoice}
        />

        <VendorMobileOrderOptionGroupProductsSection
          products={products}
          linkedProductIds={form.linked_product_ids}
          onToggleProduct={onToggleLinkedProduct}
        />

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-full bg-[var(--accent-blue)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending ? '保存中...' : isEditing ? 'オプションを更新' : 'オプションを追加'}
          </button>
          <button
            type="button"
            onClick={onStartCreateMode}
            className="rounded-full bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-700"
          >
            新規作成に切り替える
          </button>
        </div>
      </form>
    </section>
  )
}
