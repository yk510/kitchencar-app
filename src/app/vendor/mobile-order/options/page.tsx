'use client'

import { useEffect, useMemo, useState } from 'react'
import { ApiClientError, fetchApi } from '@/lib/api-client'
import { useSubmissionFeedback } from '@/lib/use-submission-feedback'
import type {
  MobileOrderProductRow,
  VendorMobileOrderOptionGroup,
  VendorMobileOrderOptionGroupMutationPayload,
  VendorMobileOrderOptionsPayload,
} from '@/types/api-payloads'

type ChoiceForm = {
  name: string
  price_delta: string
  sort_order: string
  is_active: boolean
}

type OptionGroupForm = {
  name: string
  selection_type: 'single' | 'multiple'
  is_required: boolean
  min_select: string
  max_select: string
  sort_order: string
  linked_product_ids: string[]
  choices: ChoiceForm[]
}

const EMPTY_CHOICE: ChoiceForm = {
  name: '',
  price_delta: '0',
  sort_order: '0',
  is_active: true,
}

const EMPTY_FORM: OptionGroupForm = {
  name: '',
  selection_type: 'single',
  is_required: false,
  min_select: '',
  max_select: '',
  sort_order: '0',
  linked_product_ids: [],
  choices: [{ ...EMPTY_CHOICE }],
}

function buildFormFromOptionGroup(group: VendorMobileOrderOptionGroup): OptionGroupForm {
  return {
    name: group.name,
    selection_type: group.selection_type,
    is_required: group.is_required,
    min_select: group.min_select == null ? '' : String(group.min_select),
    max_select: group.max_select == null ? '' : String(group.max_select),
    sort_order: String(group.sort_order),
    linked_product_ids: group.linked_product_ids,
    choices: group.choices.map((choice) => ({
      name: choice.name,
      price_delta: String(choice.price_delta),
      sort_order: String(choice.sort_order),
      is_active: choice.is_active,
    })),
  }
}

function getProductNames(products: MobileOrderProductRow[], productIds: string[]) {
  const map = new Map(products.map((product) => [product.id, product.name]))
  return productIds.map((productId) => map.get(productId)).filter(Boolean).join(' / ')
}

export default function VendorMobileOrderOptionsPage() {
  const [data, setData] = useState<VendorMobileOrderOptionsPayload | null>(null)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [form, setForm] = useState<OptionGroupForm>(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const { pending, error, message, setError, start, succeed, stop } = useSubmissionFeedback()

  async function load() {
    try {
      const response = await fetchApi<VendorMobileOrderOptionsPayload>('/api/vendor/mobile-order/options', {
        cache: 'no-store',
      })
      setData(response)

      if (selectedGroupId) {
        const nextSelected = response.optionGroups.find((group) => group.id === selectedGroupId)
        if (nextSelected) {
          setForm(buildFormFromOptionGroup(nextSelected))
        } else {
          setSelectedGroupId(null)
          setForm(EMPTY_FORM)
        }
      }

      setError(null)
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'オプション管理データの取得に失敗しました')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const selectedGroup = useMemo(
    () => data?.optionGroups.find((group) => group.id === selectedGroupId) ?? null,
    [data, selectedGroupId]
  )

  function startCreateMode() {
    setSelectedGroupId(null)
    setForm(EMPTY_FORM)
    setError(null)
  }

  function selectGroup(group: VendorMobileOrderOptionGroup) {
    setSelectedGroupId(group.id)
    setForm(buildFormFromOptionGroup(group))
    setError(null)
  }

  function updateChoice(index: number, patch: Partial<ChoiceForm>) {
    setForm((prev) => ({
      ...prev,
      choices: prev.choices.map((choice, currentIndex) =>
        currentIndex === index ? { ...choice, ...patch } : choice
      ),
    }))
  }

  function addChoice() {
    setForm((prev) => ({
      ...prev,
      choices: [...prev.choices, { ...EMPTY_CHOICE, sort_order: String(prev.choices.length) }],
    }))
  }

  function removeChoice(index: number) {
    setForm((prev) => ({
      ...prev,
      choices: prev.choices.filter((_, currentIndex) => currentIndex !== index),
    }))
  }

  function toggleLinkedProduct(productId: string) {
    setForm((prev) => ({
      ...prev,
      linked_product_ids: prev.linked_product_ids.includes(productId)
        ? prev.linked_product_ids.filter((id) => id !== productId)
        : [...prev.linked_product_ids, productId],
    }))
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    start()

    try {
      const payload = {
        name: form.name,
        selection_type: form.selection_type,
        is_required: form.is_required,
        min_select: form.min_select,
        max_select: form.max_select,
        sort_order: Number(form.sort_order),
        linked_product_ids: form.linked_product_ids,
        choices: form.choices.map((choice) => ({
          name: choice.name,
          price_delta: Number(choice.price_delta),
          sort_order: Number(choice.sort_order),
          is_active: choice.is_active,
        })),
      }

      if (selectedGroupId) {
        await fetchApi<VendorMobileOrderOptionGroupMutationPayload>(`/api/vendor/mobile-order/options/${selectedGroupId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        succeed('オプショングループを更新しました')
      } else {
        await fetchApi<VendorMobileOrderOptionGroupMutationPayload>('/api/vendor/mobile-order/options', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        succeed('オプショングループを追加しました')
        setForm(EMPTY_FORM)
      }

      await load()
    } catch (err) {
      stop()
      setError(err instanceof ApiClientError ? err.message : 'オプショングループの保存に失敗しました')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="badge-blue badge-soft inline-block mb-3">オプション管理</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">商品ごとの選択肢を整える</h1>
          <p className="text-sm text-gray-500">
            トッピング、辛さ、サイズなどのオプションを作り、対象商品に紐づけます。
          </p>
        </div>
        <button
          type="button"
          onClick={startCreateMode}
          className="rounded-full bg-[var(--accent-blue)] px-4 py-2 text-sm font-semibold text-white"
        >
          新しいオプションを追加
        </button>
      </div>

      {error && <p className="alert-danger px-4 py-3 text-sm text-red-700">{error}</p>}
      {message && <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{message}</p>}

      {loading ? (
        <div className="soft-panel p-6 text-sm text-gray-500">読み込み中...</div>
      ) : data ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.08fr]">
          <section className="soft-panel p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">登録済みオプション</h2>
                <p className="mt-1 text-sm text-gray-500">{data.store.store_name} で使うオプショングループ一覧です。</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {data.optionGroups.length} 件
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {data.optionGroups.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-[var(--line-soft)] bg-white px-5 py-6 text-sm text-gray-500">
                  まだオプションがありません。右側のフォームから最初のグループを追加してください。
                </div>
              ) : (
                data.optionGroups.map((group) => {
                  const selected = group.id === selectedGroupId
                  const linkedProductsLabel = getProductNames(data.products, group.linked_product_ids)

                  return (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => selectGroup(group)}
                      className={`w-full rounded-3xl border px-5 py-4 text-left transition ${
                        selected ? 'border-[var(--accent-blue)] bg-[var(--accent-blue-soft)]' : 'border-[var(--line-soft)] bg-white'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-800">{group.name}</p>
                          <p className="mt-1 text-sm text-gray-500">
                            {group.selection_type === 'single' ? '単一選択' : '複数選択'} / {group.is_required ? '必須' : '任意'}
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

          <section className="soft-panel p-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">{selectedGroup ? 'オプションを編集' : 'オプションを追加'}</h2>
              <p className="mt-1 text-sm text-gray-500">
                {selectedGroup ? '選択肢や対象商品をまとめて更新できます。' : '作成後すぐに商品へ紐付けできます。'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">グループ名</label>
                  <input
                    value={form.name}
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
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
                    onChange={(event) => setForm((prev) => ({ ...prev, sort_order: event.target.value }))}
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
                      setForm((prev) => ({ ...prev, selection_type: event.target.value as 'single' | 'multiple' }))
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
                      onChange={(event) => setForm((prev) => ({ ...prev, is_required: event.target.checked }))}
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
                    onChange={(event) => setForm((prev) => ({ ...prev, min_select: event.target.value }))}
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
                    onChange={(event) => setForm((prev) => ({ ...prev, max_select: event.target.value }))}
                    className="w-full px-4 py-3"
                    placeholder="未設定"
                  />
                </div>
              </div>

              <div className="rounded-3xl border border-[var(--line-soft)] bg-white p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-gray-800">選択肢</h3>
                    <p className="mt-1 text-sm text-gray-500">価格加算や表示順もここで設定します。</p>
                  </div>
                  <button
                    type="button"
                    onClick={addChoice}
                    className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700"
                  >
                    選択肢を追加
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {form.choices.map((choice, index) => (
                    <div key={`${index}-${choice.sort_order}`} className="rounded-2xl border border-[var(--line-soft)] px-4 py-4">
                      <div className="grid gap-3 md:grid-cols-[1.3fr_0.8fr_0.8fr_auto]">
                        <div>
                          <label className="mb-2 block text-xs font-medium text-gray-500">選択肢名</label>
                          <input
                            value={choice.name}
                            onChange={(event) => updateChoice(index, { name: event.target.value })}
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
                            onChange={(event) => updateChoice(index, { price_delta: event.target.value })}
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
                            onChange={(event) => updateChoice(index, { sort_order: event.target.value })}
                            className="w-full px-4 py-3"
                          />
                        </div>
                        <div className="flex items-end gap-2">
                          <label className="rounded-2xl border border-[var(--line-soft)] px-3 py-3 text-xs text-gray-700">
                            <input
                              type="checkbox"
                              checked={choice.is_active}
                              onChange={(event) => updateChoice(index, { is_active: event.target.checked })}
                              className="mr-2"
                            />
                            有効
                          </label>
                          <button
                            type="button"
                            onClick={() => removeChoice(index)}
                            disabled={form.choices.length === 1}
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

              <div className="rounded-3xl border border-[var(--line-soft)] bg-white p-5">
                <h3 className="text-base font-semibold text-gray-800">対象商品</h3>
                <p className="mt-1 text-sm text-gray-500">このオプションを表示したい商品にチェックを入れてください。</p>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {data.products.length === 0 ? (
                    <p className="text-sm text-gray-500">先に商品を追加すると、ここで紐付けできます。</p>
                  ) : (
                    data.products.map((product) => (
                      <label
                        key={product.id}
                        className="rounded-2xl border border-[var(--line-soft)] bg-[#fafafa] px-4 py-3 text-sm text-gray-700"
                      >
                        <input
                          type="checkbox"
                          checked={form.linked_product_ids.includes(product.id)}
                          onChange={() => toggleLinkedProduct(product.id)}
                          className="mr-2"
                        />
                        {product.name}
                      </label>
                    ))
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={pending}
                  className="rounded-full bg-[var(--accent-blue)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {pending ? '保存中...' : selectedGroup ? 'オプションを更新' : 'オプションを追加'}
                </button>
                <button
                  type="button"
                  onClick={startCreateMode}
                  className="rounded-full bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-700"
                >
                  新規作成に切り替える
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  )
}
