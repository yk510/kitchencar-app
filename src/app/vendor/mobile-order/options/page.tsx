'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import VendorMobileOrderOptionGroupFormSection from '@/components/VendorMobileOrderOptionGroupFormSection'
import VendorMobileOrderOptionGroupListSection from '@/components/VendorMobileOrderOptionGroupListSection'
import { ApiClientError, fetchApi } from '@/lib/api-client'
import { useSubmissionFeedback } from '@/lib/use-submission-feedback'
import {
  buildFormFromOptionGroup,
  EMPTY_CHOICE,
  EMPTY_FORM,
  type ChoiceForm,
  type OptionGroupForm,
} from '@/lib/vendor-mobile-order-options'
import type {
  VendorMobileOrderOptionGroup,
  VendorMobileOrderOptionGroupMutationPayload,
  VendorMobileOrderOptionsPayload,
} from '@/types/api-payloads'

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
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/products/master#mobile-order-toppings"
            className="rounded-full border border-[var(--line-soft)] bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-[var(--accent-blue)] hover:text-[var(--accent-blue)]"
          >
            トッピング原価へ
          </Link>
          <button
            type="button"
            onClick={startCreateMode}
            className="rounded-full bg-[var(--accent-blue)] px-4 py-2 text-sm font-semibold text-white"
          >
            新しいオプションを追加
          </button>
        </div>
      </div>

      <div className="soft-panel flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-gray-800">トッピングも原価登録に連携できます</p>
          <p className="mt-1 text-xs text-gray-500">
            ここで設定した選択肢は原価登録画面に自動で並びます。Airレジ商品と同じ材料として扱いたい場合も後からひも付けできます。
          </p>
        </div>
        <Link
          href="/products/master#mobile-order-toppings"
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          原価登録画面を開く
        </Link>
      </div>

      {error && <p className="alert-danger px-4 py-3 text-sm text-red-700">{error}</p>}
      {message && <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{message}</p>}

      {loading ? (
        <div className="soft-panel p-6 text-sm text-gray-500">読み込み中...</div>
      ) : data ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.08fr]">
          <VendorMobileOrderOptionGroupListSection
            storeName={data.store.store_name}
            products={data.products}
            optionGroups={data.optionGroups}
            selectedGroupId={selectedGroupId}
            onSelectGroup={selectGroup}
          />

          <VendorMobileOrderOptionGroupFormSection
            selectedGroupName={selectedGroup?.name ?? null}
            form={form}
            pending={pending}
            products={data.products}
            onChangeForm={(updater) => setForm((prev) => updater(prev))}
            onSubmit={handleSubmit}
            onAddChoice={addChoice}
            onUpdateChoice={updateChoice}
            onRemoveChoice={removeChoice}
            onToggleLinkedProduct={toggleLinkedProduct}
            onStartCreateMode={startCreateMode}
          />
        </div>
      ) : null}
    </div>
  )
}
