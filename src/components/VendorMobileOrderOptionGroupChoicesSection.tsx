import type { ChoiceForm } from '@/lib/vendor-mobile-order-options'

type Props = {
  choices: ChoiceForm[]
  onAddChoice: () => void
  onUpdateChoice: (index: number, patch: Partial<ChoiceForm>) => void
  onRemoveChoice: (index: number) => void
}

export default function VendorMobileOrderOptionGroupChoicesSection({
  choices,
  onAddChoice,
  onUpdateChoice,
  onRemoveChoice,
}: Props) {
  return (
    <div className="rounded-3xl border border-[var(--line-soft)] bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-gray-800">選択肢</h3>
          <p className="mt-1 text-sm text-gray-500">価格加算や表示順もここで設定します。</p>
        </div>
        <button
          type="button"
          onClick={onAddChoice}
          className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700"
        >
          選択肢を追加
        </button>
      </div>

      <div className="mt-4 space-y-3">
        {choices.map((choice, index) => (
          <div
            key={`${index}-${choice.sort_order}`}
            className="rounded-2xl border border-[var(--line-soft)] px-4 py-4"
          >
            <div className="grid gap-3 md:grid-cols-[1.3fr_0.8fr_0.8fr_auto]">
              <div>
                <label className="mb-2 block text-xs font-medium text-gray-500">選択肢名</label>
                <input
                  value={choice.name}
                  onChange={(event) => onUpdateChoice(index, { name: event.target.value })}
                  className="w-full px-4 py-3"
                  placeholder="例: 目玉焼き"
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-medium text-gray-500">加算額</label>
                <input
                  type="number"
                  step="1"
                  value={choice.price_delta}
                  onChange={(event) => onUpdateChoice(index, { price_delta: event.target.value })}
                  className="w-full px-4 py-3"
                />
              </div>
              <div>
                <label className="mb-2 block text-xs font-medium text-gray-500">表示順</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={choice.sort_order}
                  onChange={(event) => onUpdateChoice(index, { sort_order: event.target.value })}
                  className="w-full px-4 py-3"
                />
              </div>
              <div className="flex items-end gap-2">
                <label className="rounded-2xl border border-[var(--line-soft)] px-3 py-3 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={choice.is_active}
                    onChange={(event) => onUpdateChoice(index, { is_active: event.target.checked })}
                    className="mr-2"
                  />
                  有効
                </label>
                <button
                  type="button"
                  onClick={() => onRemoveChoice(index)}
                  disabled={choices.length === 1}
                  className="rounded-2xl bg-red-50 px-3 py-3 text-xs font-semibold text-red-600 disabled:opacity-40"
                >
                  削除
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
