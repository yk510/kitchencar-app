'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { compressImageFile } from '@/lib/client-image'
import { ApiClientError, fetchApi } from '@/lib/api-client'
import { useSubmissionFeedback } from '@/lib/use-submission-feedback'
import type {
  MobileOrderInventoryAdjustmentRow,
  MobileOrderProductRow,
  StoreOrderScheduleInventoryRow,
  VendorMobileOrderManagedProduct,
  VendorMobileOrderProductMutationPayload,
  VendorMobileOrderProductsPayload,
} from '@/types/api-payloads'

type ProductForm = {
  name: string
  description: string
  price: string
  image_url: string
  sort_order: string
  tracks_inventory: boolean
  low_stock_threshold: string
  is_published: boolean
  is_sold_out: boolean
}

const EMPTY_FORM: ProductForm = {
  name: '',
  description: '',
  price: '',
  image_url: '',
  sort_order: '0',
  tracks_inventory: false,
  low_stock_threshold: '3',
  is_published: true,
  is_sold_out: false,
}

function buildFormFromProduct(product: MobileOrderProductRow): ProductForm {
  return {
    name: product.name,
    description: product.description ?? '',
    price: String(product.price),
    image_url: product.image_url ?? '',
    sort_order: String(product.sort_order),
    tracks_inventory: product.tracks_inventory,
    low_stock_threshold: String(product.low_stock_threshold),
    is_published: product.is_published,
    is_sold_out: product.is_sold_out,
  }
}

function formatPrice(value: number) {
  return `${value.toLocaleString()} 円`
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatSignedQuantity(value: number) {
  return value > 0 ? `+${value}` : String(value)
}

function getInventoryStatusLabel(product: VendorMobileOrderManagedProduct, hasCurrentSchedule: boolean) {
  if (!product.tracks_inventory) {
    return {
      label: '在庫管理なし',
      className: 'bg-slate-100 text-slate-700',
    }
  }

  if (!hasCurrentSchedule) {
    return {
      label: '営業中の枠なし',
      className: 'bg-slate-100 text-slate-700',
    }
  }

  if (product.current_inventory_status === 'not_set') {
    return {
      label: '初期在庫未設定',
      className: 'bg-amber-100 text-amber-800',
    }
  }

  if (product.current_inventory_status === 'sold_out') {
    return {
      label: '売り切れ',
      className: 'bg-rose-100 text-rose-800',
    }
  }

  if (product.current_inventory_status === 'low_stock') {
    return {
      label: `残りわずか (${product.current_remaining_quantity ?? 0})`,
      className: 'bg-orange-100 text-orange-800',
    }
  }

  return {
    label: product.current_remaining_quantity != null ? `残数 ${product.current_remaining_quantity}` : '在庫あり',
    className: 'bg-emerald-50 text-emerald-700',
  }
}

export default function VendorMobileOrderProductsPage() {
  const [data, setData] = useState<VendorMobileOrderProductsPayload | null>(null)
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM)
  const [loading, setLoading] = useState(true)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [inventoryPending, setInventoryPending] = useState(false)
  const [initialInventoryQuantity, setInitialInventoryQuantity] = useState('')
  const [adjustmentQuantity, setAdjustmentQuantity] = useState('')
  const [adjustmentReason, setAdjustmentReason] = useState('')
  const { pending, error, message, setError, start, succeed, stop } = useSubmissionFeedback()

  async function load() {
    try {
      const response = await fetchApi<VendorMobileOrderProductsPayload>('/api/vendor/mobile-order/products', {
        cache: 'no-store',
      })
      setData(response)

      if (selectedProductId) {
        const nextSelected = response.products.find((product) => product.id === selectedProductId)
        if (nextSelected) {
          setForm(buildFormFromProduct(nextSelected))
        } else {
          setSelectedProductId(null)
          setForm(EMPTY_FORM)
        }
      }

      setError(null)
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : '商品一覧の取得に失敗しました')
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

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
    setError(null)
  }

  function selectProduct(product: MobileOrderProductRow) {
    setSelectedProductId(product.id)
    setForm(buildFormFromProduct(product))
    setError(null)
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
          sort_order: product.sort_order,
          tracks_inventory: product.tracks_inventory,
          low_stock_threshold: product.low_stock_threshold,
          is_published: patch.is_published ?? product.is_published,
          is_sold_out: patch.is_sold_out ?? product.is_sold_out,
        }),
      })
      await load()
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : '商品の更新に失敗しました')
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
        <button
          type="button"
          onClick={startCreateMode}
          className="rounded-full bg-[var(--accent-blue)] px-4 py-2 text-sm font-semibold text-white"
        >
          新しい商品を追加
        </button>
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
          現在の営業枠: {formatDateTime(data.currentSchedule.opens_at)} - {formatDateTime(data.currentSchedule.closes_at)}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-[var(--line-soft)] bg-white px-5 py-4 text-sm text-gray-500">
          いま受付中の営業枠はありません。在庫管理を使う商品は、営業開始後に初期在庫を設定してください。
        </div>
      )}

      {error && <p className="alert-danger px-4 py-3 text-sm text-red-700">{error}</p>}
      {message && <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{message}</p>}

      {loading ? (
        <div className="soft-panel p-6 text-sm text-gray-500">読み込み中...</div>
      ) : data ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.08fr]">
          <section className="soft-panel p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">登録済み商品</h2>
                <p className="mt-1 text-sm text-gray-500">{data.store.store_name} の注文ページに表示される商品です。</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {data.products.length} 件
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {data.products.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-[var(--line-soft)] bg-white px-5 py-6 text-sm text-gray-500">
                  まだ商品がありません。右側のフォームから最初の商品を追加してください。
                </div>
              ) : (
                data.products.map((product) => {
                  const selected = product.id === selectedProductId
                  const inventoryStatus = getInventoryStatusLabel(product, Boolean(data.currentSchedule))

                  return (
                    <div
                      key={product.id}
                      className={`rounded-3xl border px-5 py-4 transition ${
                        selected ? 'border-[var(--accent-blue)] bg-[var(--accent-blue-soft)]' : 'border-[var(--line-soft)] bg-white'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <button type="button" onClick={() => selectProduct(product)} className="min-w-0 flex-1 text-left">
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
                              <p className="mt-1 text-sm text-gray-500">{formatPrice(product.price)} / 表示順 {product.sort_order}</p>
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                                <span className="rounded-full bg-white px-2.5 py-1 font-semibold text-slate-700 ring-1 ring-[var(--line-soft)]">
                                  注文済み {product.current_ordered_quantity}
                                </span>
                                {product.tracks_inventory && data.currentSchedule && product.current_initial_quantity != null && (
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
                            onClick={() => void handleQuickToggle(product, { is_published: !product.is_published })}
                            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                              product.is_published ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {product.is_published ? '公開中' : '非公開'}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleQuickToggle(product, { is_sold_out: !product.is_sold_out })}
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

          <section className="space-y-6">
            <div className="soft-panel p-6">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">{selectedProduct ? '商品を編集' : '商品を追加'}</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {selectedProduct ? '公開状態や価格を更新できます。' : '注文ページに表示する商品を新しく登録します。'}
                </p>
              </div>

              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                <div className="rounded-3xl border border-[var(--line-soft)] bg-white p-5">
                  <h3 className="text-base font-semibold text-gray-800">商品画像</h3>
                  <div className="mt-4 flex flex-wrap items-start gap-4">
                    <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-3xl border border-[var(--line-soft)] bg-[#f8fafc]">
                      {form.image_url ? (
                        <img src={form.image_url} alt="商品画像" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-xs text-gray-400">未設定</span>
                      )}
                    </div>
                    <div className="min-w-[220px] flex-1">
                      <input type="file" accept="image/*" onChange={handleImageChange} className="block w-full text-sm text-gray-600" />
                      <p className="mt-2 text-xs text-gray-500">
                        注文画面に使う画像をアップロードできます。保存前にブラウザ側で圧縮します。
                      </p>
                      {uploadingImage && <p className="mt-2 text-xs font-medium text-[var(--accent-blue)]">画像を処理しています...</p>}
                      {form.image_url && (
                        <button
                          type="button"
                          onClick={() => setForm((prev) => ({ ...prev, image_url: '' }))}
                          className="mt-3 rounded-full bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600"
                        >
                          商品画像を削除
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">商品名</label>
                  <input
                    value={form.name}
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                    className="w-full px-4 py-3"
                    placeholder="例: チキンオーバーライス"
                    required
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">商品説明</label>
                  <textarea
                    value={form.description}
                    onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                    className="w-full min-h-[120px] px-4 py-3"
                    placeholder="例: スパイスが香る定番メニュー"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">価格</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={form.price}
                      onChange={(event) => setForm((prev) => ({ ...prev, price: event.target.value }))}
                      className="w-full px-4 py-3"
                      placeholder="例: 900"
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
                      placeholder="例: 10"
                      required
                    />
                  </div>
                </div>

                <div className="rounded-3xl border border-[var(--line-soft)] bg-white p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-gray-800">在庫管理</h3>
                      <p className="mt-1 text-sm text-gray-500">
                        商品マスタでは在庫管理の有無だけを設定します。実際の在庫数は営業枠ごとに初期在庫と調整履歴で管理します。
                      </p>
                    </div>
                    <label className="rounded-2xl border border-[var(--line-soft)] bg-[#fafafa] px-4 py-3 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={form.tracks_inventory}
                        onChange={(event) => setForm((prev) => ({ ...prev, tracks_inventory: event.target.checked }))}
                        className="mr-2"
                      />
                      この商品は在庫を管理する
                    </label>
                  </div>

                  {form.tracks_inventory && (
                    <div className="mt-4">
                      <label className="mb-2 block text-sm font-medium text-gray-700">残りわずか表示の閾値</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={form.low_stock_threshold}
                        onChange={(event) => setForm((prev) => ({ ...prev, low_stock_threshold: event.target.value }))}
                        className="w-full px-4 py-3 md:max-w-sm"
                        placeholder="例: 3"
                      />
                      <p className="mt-2 text-xs text-gray-500">
                        残数がこの数以下になると注文画面で「残りわずか」と表示します。
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <label className="rounded-2xl border border-[var(--line-soft)] bg-white px-4 py-3 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.is_published}
                      onChange={(event) => setForm((prev) => ({ ...prev, is_published: event.target.checked }))}
                      className="mr-2"
                    />
                    注文ページに公開する
                  </label>
                  <label className="rounded-2xl border border-[var(--line-soft)] bg-white px-4 py-3 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={form.is_sold_out}
                      onChange={(event) => setForm((prev) => ({ ...prev, is_sold_out: event.target.checked }))}
                      className="mr-2"
                    />
                    売り切れとして表示する
                  </label>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={pending}
                    className="rounded-full bg-[var(--accent-blue)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {pending ? '保存中...' : selectedProduct ? '商品を更新' : '商品を追加'}
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
            </div>

            {selectedProduct?.tracks_inventory && (
              <div className="soft-panel p-6">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">営業中の在庫台帳</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    初期在庫は一度設定すると固定されます。補充やロスは差分で記録して、後から変化が追えるようにします。
                  </p>
                </div>

                {!data.currentSchedule ? (
                  <div className="mt-5 rounded-3xl border border-dashed border-[var(--line-soft)] bg-white px-5 py-5 text-sm text-gray-500">
                    受付中の営業枠がないため、在庫台帳はまだ表示できません。営業枠を開始したあとに初期在庫を設定してください。
                  </div>
                ) : selectedProduct.current_initial_quantity == null ? (
                  <form onSubmit={handleSetInitialInventory} className="mt-5 rounded-3xl border border-[var(--line-soft)] bg-white p-5">
                    <p className="text-sm font-semibold text-gray-800">この営業枠の初期在庫を設定する</p>
                    <p className="mt-2 text-xs leading-6 text-gray-500">
                      {formatDateTime(data.currentSchedule.opens_at)} - {formatDateTime(data.currentSchedule.closes_at)} の初期在庫です。設定後は直接変更できません。
                    </p>
                    <div className="mt-4 flex flex-wrap items-end gap-3">
                      <div className="min-w-[180px] flex-1">
                        <label className="mb-2 block text-sm font-medium text-gray-700">初期在庫数</label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={initialInventoryQuantity}
                          onChange={(event) => setInitialInventoryQuantity(event.target.value)}
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
                        <p className="mt-2 text-xl font-bold text-gray-800">{selectedProduct.current_initial_quantity}</p>
                      </div>
                      <div className="rounded-3xl border border-[var(--line-soft)] bg-white px-4 py-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">調整累計</p>
                        <p className="mt-2 text-xl font-bold text-gray-800">{formatSignedQuantity(selectedProduct.current_adjustment_total)}</p>
                      </div>
                      <div className="rounded-3xl border border-[var(--line-soft)] bg-white px-4 py-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">注文数</p>
                        <p className="mt-2 text-xl font-bold text-gray-800">{selectedProduct.current_ordered_quantity}</p>
                      </div>
                      <div className="rounded-3xl border border-[var(--line-soft)] bg-white px-4 py-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">現在残数</p>
                        <p className="mt-2 text-xl font-bold text-gray-800">{selectedProduct.current_remaining_quantity ?? '-'}</p>
                      </div>
                    </div>

                    <form onSubmit={handleAddInventoryAdjustment} className="rounded-3xl border border-[var(--line-soft)] bg-white p-5">
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
                            onChange={(event) => setAdjustmentQuantity(event.target.value)}
                            className="w-full px-4 py-3"
                            placeholder="例: +5 / -2"
                          />
                        </div>
                        <div>
                          <label className="mb-2 block text-sm font-medium text-gray-700">理由メモ</label>
                          <input
                            value={adjustmentReason}
                            onChange={(event) => setAdjustmentReason(event.target.value)}
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
                          {selectedProduct.current_inventory_adjustments.length} 件
                        </span>
                      </div>
                      {selectedProduct.current_inventory_adjustments.length === 0 ? (
                        <p className="mt-4 text-sm text-gray-500">まだ差分調整はありません。</p>
                      ) : (
                        <div className="mt-4 space-y-3">
                          {selectedProduct.current_inventory_adjustments.map((adjustment) => (
                            <div
                              key={adjustment.id}
                              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--line-soft)] bg-[#fafafa] px-4 py-3"
                            >
                              <div>
                                <p className="text-sm font-semibold text-gray-800">{formatSignedQuantity(adjustment.adjustment_quantity)}</p>
                                <p className="mt-1 text-xs text-gray-500">{adjustment.reason || '理由メモなし'}</p>
                              </div>
                              <p className="text-xs text-gray-500">{formatDateTime(adjustment.created_at)}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  )
}
