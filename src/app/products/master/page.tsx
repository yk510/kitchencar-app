'use client'

import { useEffect, useMemo, useState } from 'react'
import { ApiClientError, fetchApi } from '@/lib/api-client'
import { usePersistentDraft } from '@/lib/usePersistentDraft'
import type {
  MutationSuccessPayload,
  ProductMasterListPayload,
  ProductMasterMobileOrderLinkPayload,
  ProductMasterRecordPayload,
} from '@/types/api-payloads'

type DraftInput = {
  amount: string
  rate: string
  mode: 'amount' | 'rate'
  matchProductMasterId: string
}

type DraftMap = Record<string, DraftInput>

const EMPTY_DRAFT_INPUT: DraftInput = {
  amount: '',
  rate: '',
  mode: 'amount',
  matchProductMasterId: '',
}

function buildStandaloneDraft(product: ProductMasterRecordPayload): DraftInput {
  return {
    amount: product.cost_amount != null ? String(product.cost_amount) : '',
    rate: product.cost_rate != null ? String(product.cost_rate) : '',
    mode: product.cost_rate != null ? 'rate' : 'amount',
    matchProductMasterId: '',
  }
}

function buildMobileDraft(product: ProductMasterMobileOrderLinkPayload): DraftInput {
  return {
    amount: product.cost_amount != null ? String(product.cost_amount) : '',
    rate: product.cost_rate != null ? String(product.cost_rate) : '',
    mode: product.cost_rate != null ? 'rate' : 'amount',
    matchProductMasterId: product.link_mode === 'matched_existing' ? product.linked_product_master_id ?? '' : '',
  }
}

function formatCurrentCost(costAmount: number | null, costRate: number | null) {
  if (costAmount != null) return `${costAmount.toLocaleString()} 円`
  if (costRate != null) return `${costRate} %`
  return null
}

function keyForStandalone(productId: string) {
  return `pm:${productId}`
}

function keyForMobile(productId: string) {
  return `mo:${productId}`
}

export default function ProductMasterPage() {
  const draftState = usePersistentDraft<DraftMap>('draft:product-master-inputs', {})
  const [mobileOrderProducts, setMobileOrderProducts] = useState<ProductMasterMobileOrderLinkPayload[]>([])
  const [standaloneProducts, setStandaloneProducts] = useState<ProductMasterRecordPayload[]>([])
  const [allProductMasters, setAllProductMasters] = useState<ProductMasterRecordPayload[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [inputs, setInputs] = useState<DraftMap>(draftState.value)

  useEffect(() => {
    if (!draftState.hydrated) return
    draftState.setValue(inputs)
  }, [inputs, draftState.hydrated, draftState.setValue])

  async function load() {
    setLoading(true)
    try {
      const data = await fetchApi<ProductMasterListPayload>('/api/products/master', {
        cache: 'no-store',
      })

      setMobileOrderProducts(data.mobile_order_products)
      setStandaloneProducts(data.standalone_products)
      setAllProductMasters(data.all_product_masters)

      const init: DraftMap = {}
      for (const product of data.mobile_order_products) {
        init[keyForMobile(product.mobile_order_product_id)] = buildMobileDraft(product)
      }
      for (const product of data.standalone_products) {
        init[keyForStandalone(product.id)] = buildStandaloneDraft(product)
      }

      setInputs(draftState.hasStoredDraft ? { ...init, ...draftState.value } : init)
    } catch (err) {
      alert(err instanceof ApiClientError ? err.message : '商品一覧の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function saveStandaloneProduct(product: ProductMasterRecordPayload) {
    const key = keyForStandalone(product.id)
    const input = inputs[key]
    if (!input) return

    const rawValue = input.mode === 'rate' ? input.rate : input.amount
    const parsedValue = parseFloat(rawValue)
    if (!rawValue || Number.isNaN(parsedValue) || parsedValue < 0) {
      alert('正しい数値を入力してください')
      return
    }

    setSaving(key)
    try {
      const body: Record<string, unknown> = {
        product_master_id: product.id,
      }
      if (input.mode === 'rate') body.cost_rate = parsedValue
      else body.cost_amount = Math.round(parsedValue)

      await fetchApi<MutationSuccessPayload>('/api/products/master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      draftState.clearDraft()
      await load()
    } catch (err) {
      alert(err instanceof ApiClientError ? err.message : '保存に失敗しました')
    } finally {
      setSaving(null)
    }
  }

  async function saveMobileOrderProduct(product: ProductMasterMobileOrderLinkPayload) {
    const key = keyForMobile(product.mobile_order_product_id)
    const input = inputs[key]
    if (!input) return

    const rawValue = input.mode === 'rate' ? input.rate : input.amount
    const parsedValue = parseFloat(rawValue)
    if (!rawValue || Number.isNaN(parsedValue) || parsedValue < 0) {
      alert('正しい数値を入力してください')
      return
    }

    setSaving(key)
    try {
      const body: Record<string, unknown> = {
        mobile_order_product_id: product.mobile_order_product_id,
        linked_product_master_id: input.matchProductMasterId,
      }
      if (input.mode === 'rate') body.cost_rate = parsedValue
      else body.cost_amount = Math.round(parsedValue)

      await fetchApi<MutationSuccessPayload>('/api/products/master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      draftState.clearDraft()
      await load()
    } catch (err) {
      alert(err instanceof ApiClientError ? err.message : '保存に失敗しました')
    } finally {
      setSaving(null)
    }
  }

  const unregisteredMobile = useMemo(
    () => mobileOrderProducts.filter((product) => product.cost_amount == null && product.cost_rate == null),
    [mobileOrderProducts]
  )
  const registeredMobile = useMemo(
    () => mobileOrderProducts.filter((product) => product.cost_amount != null || product.cost_rate != null),
    [mobileOrderProducts]
  )
  const unregisteredStandalone = useMemo(
    () => standaloneProducts.filter((product) => product.cost_amount == null && product.cost_rate == null),
    [standaloneProducts]
  )
  const registeredStandalone = useMemo(
    () => standaloneProducts.filter((product) => product.cost_amount != null || product.cost_rate != null),
    [standaloneProducts]
  )

  if (loading) {
    return <p className="text-gray-400">読み込み中...</p>
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">原価マスタ管理</h1>
      <p className="text-sm text-gray-500 mb-8">
        モバイルオーダーの商品から直接原価を登録できます。Airレジで取り込んだ商品と突合したい場合は、既存商品を選んで同じ原価マスタへ連携してください。
      </p>

      {mobileOrderProducts.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded-full">
              モバイルオーダー {mobileOrderProducts.length}件
            </span>
            <h2 className="text-lg font-semibold text-gray-700">モバイルオーダー商品から原価を登録する</h2>
          </div>
          <div className="space-y-3">
            {unregisteredMobile.map((product) => (
              <MobileOrderProductRow
                key={product.mobile_order_product_id}
                product={product}
                allProductMasters={allProductMasters}
                input={inputs[keyForMobile(product.mobile_order_product_id)] ?? EMPTY_DRAFT_INPUT}
                onInputChange={(field, value) =>
                  setInputs((prev) => ({
                    ...prev,
                    [keyForMobile(product.mobile_order_product_id)]: {
                      ...(prev[keyForMobile(product.mobile_order_product_id)] ?? EMPTY_DRAFT_INPUT),
                      [field]: value,
                    },
                  }))
                }
                onSave={() => saveMobileOrderProduct(product)}
                saving={saving === keyForMobile(product.mobile_order_product_id)}
                highlight
              />
            ))}
            {registeredMobile.map((product) => (
              <MobileOrderProductRow
                key={product.mobile_order_product_id}
                product={product}
                allProductMasters={allProductMasters}
                input={inputs[keyForMobile(product.mobile_order_product_id)] ?? EMPTY_DRAFT_INPUT}
                onInputChange={(field, value) =>
                  setInputs((prev) => ({
                    ...prev,
                    [keyForMobile(product.mobile_order_product_id)]: {
                      ...(prev[keyForMobile(product.mobile_order_product_id)] ?? EMPTY_DRAFT_INPUT),
                      [field]: value,
                    },
                  }))
                }
                onSave={() => saveMobileOrderProduct(product)}
                saving={saving === keyForMobile(product.mobile_order_product_id)}
                highlight={false}
              />
            ))}
          </div>
        </section>
      )}

      {standaloneProducts.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-1 rounded-full">
              その他 {standaloneProducts.length}件
            </span>
            <h2 className="text-lg font-semibold text-gray-700">Airレジ・手入力で登録された商品</h2>
          </div>
          <div className="space-y-3">
            {unregisteredStandalone.map((product) => (
              <StandaloneProductRow
                key={product.id}
                product={product}
                input={inputs[keyForStandalone(product.id)] ?? EMPTY_DRAFT_INPUT}
                onInputChange={(field, value) =>
                  setInputs((prev) => ({
                    ...prev,
                    [keyForStandalone(product.id)]: {
                      ...(prev[keyForStandalone(product.id)] ?? EMPTY_DRAFT_INPUT),
                      [field]: value,
                    },
                  }))
                }
                onSave={() => saveStandaloneProduct(product)}
                saving={saving === keyForStandalone(product.id)}
                highlight
              />
            ))}
            {registeredStandalone.map((product) => (
              <StandaloneProductRow
                key={product.id}
                product={product}
                input={inputs[keyForStandalone(product.id)] ?? EMPTY_DRAFT_INPUT}
                onInputChange={(field, value) =>
                  setInputs((prev) => ({
                    ...prev,
                    [keyForStandalone(product.id)]: {
                      ...(prev[keyForStandalone(product.id)] ?? EMPTY_DRAFT_INPUT),
                      [field]: value,
                    },
                  }))
                }
                onSave={() => saveStandaloneProduct(product)}
                saving={saving === keyForStandalone(product.id)}
                highlight={false}
              />
            ))}
          </div>
        </section>
      )}

      {mobileOrderProducts.length === 0 && standaloneProducts.length === 0 && (
        <div className="text-center text-gray-400 py-20">
          <p className="text-5xl mb-4">📦</p>
          <p>商品がまだ登録されていません。</p>
          <p className="text-sm mt-1">CSVをアップロードするか、モバイルオーダーの商品設定を登録するとここに表示されます。</p>
          <a href="/upload" className="inline-block mt-4 text-blue-600 underline text-sm">
            CSVをアップロードする →
          </a>
        </div>
      )}
    </div>
  )
}

type BaseRowProps = {
  input: DraftInput
  onInputChange: (field: keyof DraftInput, value: string) => void
  onSave: () => void
  saving: boolean
  highlight: boolean
}

function CostInputControls({ input, onInputChange, onSave, saving }: BaseRowProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 text-sm">
        <button
          onClick={() => onInputChange('mode', 'amount')}
          className={`px-3 py-1 rounded-l-lg border ${
            input.mode === 'amount'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
          }`}
        >
          円
        </button>
        <button
          onClick={() => onInputChange('mode', 'rate')}
          className={`px-3 py-1 rounded-r-lg border-t border-b border-r ${
            input.mode === 'rate'
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
          }`}
        >
          %
        </button>
      </div>
      <input
        type="number"
        min="0"
        step={input.mode === 'rate' ? '0.1' : '1'}
        value={input.mode === 'amount' ? input.amount : input.rate}
        onChange={(event) => onInputChange(input.mode === 'amount' ? 'amount' : 'rate', event.target.value)}
        placeholder={input.mode === 'amount' ? '例: 150' : '例: 35.0'}
        className="w-28 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      <span className="text-sm text-gray-500">{input.mode === 'amount' ? '円' : '%'}</span>
      <button
        onClick={onSave}
        disabled={saving}
        className="bg-blue-600 text-white rounded-lg px-4 py-1.5 text-sm hover:bg-blue-700 disabled:opacity-40 whitespace-nowrap"
      >
        {saving ? '保存中...' : '保存'}
      </button>
    </div>
  )
}

function MobileOrderProductRow({
  product,
  allProductMasters,
  input,
  onInputChange,
  onSave,
  saving,
  highlight,
}: BaseRowProps & {
  product: ProductMasterMobileOrderLinkPayload
  allProductMasters: ProductMasterRecordPayload[]
}) {
  const currentCost = formatCurrentCost(product.cost_amount, product.cost_rate)

  return (
    <div
      className={`bg-white rounded-xl border p-4 flex flex-col gap-4 ${
        highlight ? 'border-blue-300 bg-blue-50/40' : 'border-gray-200'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className="font-medium text-gray-800">{product.mobile_order_product_name}</p>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700">モバイルオーダー</span>
          </div>
          <p className="text-xs text-gray-500">販売価格: {product.mobile_order_product_price.toLocaleString()} 円</p>
          {currentCost && <p className="text-xs text-gray-400 mt-0.5">現在の原価: {currentCost}</p>}
          {product.linked_product_master_name ? (
            <p className="text-xs text-gray-500 mt-1">
              原価連携先: <span className="font-medium text-gray-700">{product.linked_product_master_name}</span>
              {product.link_mode === 'matched_existing' ? '（既存商品と突合）' : '（この商品専用）'}
            </p>
          ) : (
            <p className="text-xs text-amber-700 mt-1">まだ原価マスタと連携されていません。必要なら既存商品を選んで突合できます。</p>
          )}
        </div>
        <div className="min-w-[240px]">
          <label className="text-xs font-semibold text-gray-500 block mb-1">既存のAirレジ商品と突合</label>
          <select
            value={input.matchProductMasterId}
            onChange={(event) => onInputChange('matchProductMasterId', event.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="">この商品専用で管理する</option>
            {allProductMasters.map((item) => (
              <option key={item.id} value={item.id}>
                {item.product_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <CostInputControls
        input={input}
        onInputChange={onInputChange}
        onSave={onSave}
        saving={saving}
        highlight={highlight}
      />
    </div>
  )
}

function StandaloneProductRow({
  product,
  input,
  onInputChange,
  onSave,
  saving,
  highlight,
}: BaseRowProps & {
  product: ProductMasterRecordPayload
}) {
  const currentCost = formatCurrentCost(product.cost_amount, product.cost_rate)

  return (
    <div
      className={`bg-white rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center gap-3 ${
        highlight ? 'border-amber-300 bg-amber-50' : 'border-gray-200'
      }`}
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-800 truncate">{product.product_name}</p>
        {currentCost && <p className="text-xs text-gray-400 mt-0.5">現在の原価: {currentCost}</p>}
      </div>

      <CostInputControls
        input={input}
        onInputChange={onInputChange}
        onSave={onSave}
        saving={saving}
        highlight={highlight}
      />
    </div>
  )
}
