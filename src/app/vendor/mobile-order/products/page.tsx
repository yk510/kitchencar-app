'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { VendorMobileOrderInventorySection } from '@/components/VendorMobileOrderInventorySection'
import { VendorMobileOrderProductFormSection } from '@/components/VendorMobileOrderProductFormSection'
import { VendorMobileOrderProductListSection } from '@/components/VendorMobileOrderProductListSection'
import { compressImageFile } from '@/lib/client-image'
import { ApiClientError, fetchApi } from '@/lib/api-client'
import { useSubmissionFeedback } from '@/lib/use-submission-feedback'
import { useVendorMobileOrderAdminResource } from '@/lib/use-vendor-mobile-order-admin-resource'
import {
  buildFormFromProduct,
  EMPTY_FORM,
  formatProductDateTime,
  normalizeDisplayCategory,
  type ProductForm,
} from '@/lib/vendor-mobile-order-products'
import type {
  MobileOrderInventoryAdjustmentRow,
  MobileOrderProductRow,
  StoreOrderScheduleInventoryRow,
  VendorMobileOrderProductMutationPayload,
  VendorMobileOrderProductsPayload,
} from '@/types/api-payloads'

export default function VendorMobileOrderProductsPage() {
  const { data, loading, error: loadError, setError: setLoadError, load } =
    useVendorMobileOrderAdminResource<VendorMobileOrderProductsPayload>({
      endpoint: '/api/vendor/mobile-order/products',
      errorMessage: '商品一覧の取得に失敗しました',
    })
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [inventoryPending, setInventoryPending] = useState(false)
  const [initialInventoryQuantity, setInitialInventoryQuantity] = useState('')
  const [adjustmentQuantity, setAdjustmentQuantity] = useState('')
  const [adjustmentReason, setAdjustmentReason] = useState('')
  const { pending, error, message, setError, start, succeed, stop } = useSubmissionFeedback()

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    if (!data || !selectedProductId) return
    const nextSelected = data.products.find((product) => product.id === selectedProductId)
    if (nextSelected) {
      setForm(buildFormFromProduct(nextSelected))
    } else {
      setSelectedProductId(null)
      setForm(EMPTY_FORM)
    }
  }, [data, selectedProductId])

  const selectedProduct = useMemo(
    () => data?.products.find((product) => product.id === selectedProductId) ?? null,
    [data, selectedProductId]
  )

  useEffect(() => {
    setInitialInventoryQuantity('')
    setAdjustmentQuantity('')
    setAdjustmentReason('')
  }, [selectedProductId, data?.currentSchedule?.id])

  function startCreateMode() {
    setSelectedProductId(null)
    setForm(EMPTY_FORM)
    setInitialInventoryQuantity('')
    setAdjustmentQuantity('')
    setAdjustmentReason('')
    setLoadError(null)
  }

  function selectProduct(product: MobileOrderProductRow) {
    setSelectedProductId(product.id)
    setForm(buildFormFromProduct(product))
    setLoadError(null)
  }

  async function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setUploadingImage(true)
    try {
      const compressed = await compressImageFile(file, {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 0.84,
      })
      setForm((prev) => ({ ...prev, image_url: compressed }))
    } catch {
      setError('商品画像の読み込みに失敗しました')
    } finally {
      setUploadingImage(false)
      event.target.value = ''
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    start()

    try {
      const payload = {
        name: form.name,
        description: form.description,
        price: Number(form.price),
        image_url: form.image_url,
        display_category: form.display_category,
        is_recommended: form.is_recommended,
        sort_order: Number(form.sort_order),
        tracks_inventory: form.tracks_inventory,
        low_stock_threshold: form.low_stock_threshold,
        is_published: form.is_published,
        is_sold_out: form.is_sold_out,
      }

      if (selectedProductId) {
        await fetchApi<VendorMobileOrderProductMutationPayload>(`/api/vendor/mobile-order/products/${selectedProductId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        succeed('商品を更新しました')
      } else {
        await fetchApi<VendorMobileOrderProductMutationPayload>('/api/vendor/mobile-order/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        succeed('商品を追加しました')
        setForm(EMPTY_FORM)
      }

      await load()
    } catch (err) {
      stop()
      setError(err instanceof ApiClientError ? err.message : '商品の保存に失敗しました')
    }
  }

  async function handleQuickToggle(product: MobileOrderProductRow, patch: Partial<ProductForm>) {
    try {
      await fetchApi<VendorMobileOrderProductMutationPayload>(`/api/vendor/mobile-order/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: product.name,
          description: product.description ?? '',
          price: product.price,
          image_url: product.image_url ?? '',
          display_category: normalizeDisplayCategory(product.display_category),
          is_recommended: Boolean(product.is_recommended),
          sort_order: product.sort_order,
          tracks_inventory: product.tracks_inventory,
          low_stock_threshold: product.low_stock_threshold,
          is_published: patch.is_published ?? product.is_published,
          is_sold_out: patch.is_sold_out ?? product.is_sold_out,
        }),
      })
      await load()
    } catch (err) {
      setLoadError(err instanceof ApiClientError ? err.message : '商品の更新に失敗しました')
    }
  }

  async function handleSetInitialInventory(event: React.FormEvent) {
    event.preventDefault()

    if (!selectedProduct || !data?.currentSchedule) {
      setError('営業中の営業枠が見つかりません')
      return
    }

    const quantity = Number(initialInventoryQuantity)
    if (!Number.isInteger(quantity) || quantity < 0) {
      setError('初期在庫数は0以上の整数で入力してください')
      return
    }

    setInventoryPending(true)
    try {
      await fetchApi<StoreOrderScheduleInventoryRow>(`/api/vendor/mobile-order/products/${selectedProduct.id}/inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schedule_id: data.currentSchedule.id,
          initial_quantity: quantity,
        }),
      })
      succeed('初期在庫を設定しました')
      setInitialInventoryQuantity('')
      await load()
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : '初期在庫の設定に失敗しました')
    } finally {
      setInventoryPending(false)
    }
  }

  async function handleAddInventoryAdjustment(event: React.FormEvent) {
    event.preventDefault()

    if (!selectedProduct || !data?.currentSchedule) {
      setError('営業中の営業枠が見つかりません')
      return
    }

    const quantity = Number(adjustmentQuantity)
    if (!Number.isInteger(quantity) || quantity === 0) {
      setError('在庫調整数は0以外の整数で入力してください')
      return
    }

    setInventoryPending(true)
    try {
      await fetchApi<MobileOrderInventoryAdjustmentRow>(
        `/api/vendor/mobile-order/products/${selectedProduct.id}/inventory-adjustments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            schedule_id: data.currentSchedule.id,
            adjustment_quantity: quantity,
            reason: adjustmentReason,
          }),
        }
      )
      succeed('在庫調整を追加しました')
      setAdjustmentQuantity('')
      setAdjustmentReason('')
      await load()
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : '在庫調整の保存に失敗しました')
    } finally {
      setInventoryPending(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="badge-blue badge-soft inline-block mb-3">商品管理</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">モバイルオーダーの商品を整える</h1>
          <p className="text-sm text-gray-500">
            公開する商品、価格、画像、売り切れ状態と、営業中の在庫運用をここから管理します。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/products/master#mobile-order-products"
            className="rounded-full border border-[var(--line-soft)] bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-[var(--accent-blue)] hover:text-[var(--accent-blue)]"
          >
            原価登録へ
          </Link>
          <button
            type="button"
            onClick={startCreateMode}
            className="rounded-full bg-[var(--accent-blue)] px-4 py-2 text-sm font-semibold text-white"
          >
            新しい商品を追加
          </button>
        </div>
      </div>

      <div className="soft-panel flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div>
          <p className="text-sm font-semibold text-gray-800">商品を追加・更新したら原価も登録できます</p>
          <p className="mt-1 text-xs text-gray-500">
            ここで設定した商品は原価登録画面に自動で並びます。商品名を変更しても同じ商品として追従します。
          </p>
        </div>
        <Link
          href="/products/master#mobile-order-products"
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
        >
          原価登録画面を開く
        </Link>
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        <Link
          href="/vendor/mobile-order"
          className="rounded-full bg-slate-100 px-4 py-2 font-medium text-slate-700 transition hover:bg-slate-200"
        >
          モバイル注文トップへ戻る
        </Link>
        <Link
          href="/vendor/mobile-order/options"
          className="rounded-full bg-white px-4 py-2 font-medium text-[var(--accent-blue)] ring-1 ring-[var(--accent-blue-soft)] transition hover:bg-[var(--accent-blue-soft)]"
        >
          オプション管理へ
        </Link>
      </div>

      {data?.currentSchedule ? (
        <div className="rounded-3xl border border-[var(--line-soft)] bg-white px-5 py-4 text-sm text-gray-600">
          現在の営業枠: {formatProductDateTime(data.currentSchedule.opens_at)} - {formatProductDateTime(data.currentSchedule.closes_at)}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-[var(--line-soft)] bg-white px-5 py-4 text-sm text-gray-500">
          いま受付中の営業枠はありません。在庫管理を使う商品は、営業開始後に初期在庫を設定してください。
        </div>
      )}

      {loadError && <p className="alert-danger px-4 py-3 text-sm text-red-700">{loadError}</p>}
      {message && <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{message}</p>}

      {loading ? (
        <div className="soft-panel p-6 text-sm text-gray-500">読み込み中...</div>
      ) : data ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.08fr]">
          <VendorMobileOrderProductListSection
            products={data.products}
            currentSchedule={data.currentSchedule}
            selectedProductId={selectedProductId}
            storeName={data.store.store_name}
            onSelectProduct={selectProduct}
            onQuickToggle={(product, patch) => void handleQuickToggle(product, patch)}
          />

          <section className="space-y-6">
            <VendorMobileOrderProductFormSection
              selectedProductId={selectedProductId}
              form={form}
              pending={pending}
              uploadingImage={uploadingImage}
              onSubmit={handleSubmit}
              onStartCreateMode={startCreateMode}
              onImageChange={handleImageChange}
              onFormChange={setForm}
            />

            <VendorMobileOrderInventorySection
              product={selectedProduct}
              currentSchedule={data.currentSchedule}
              inventoryPending={inventoryPending}
              initialInventoryQuantity={initialInventoryQuantity}
              adjustmentQuantity={adjustmentQuantity}
              adjustmentReason={adjustmentReason}
              onInitialInventoryQuantityChange={setInitialInventoryQuantity}
              onAdjustmentQuantityChange={setAdjustmentQuantity}
              onAdjustmentReasonChange={setAdjustmentReason}
              onSetInitialInventory={handleSetInitialInventory}
              onAddInventoryAdjustment={handleAddInventoryAdjustment}
            />
          </section>
        </div>
      ) : null}
    </div>
  )
}
