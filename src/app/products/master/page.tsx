'use client'

import { useState, useEffect } from 'react'

interface ProductMaster {
  product_name:    string
  cost_amount:     number | null
  cost_rate:       number | null
  cost_updated_at: string | null
}

export default function ProductMasterPage() {
  const [products, setProducts] = useState<ProductMaster[]>([])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState<string | null>(null)
  // 入力値を管理: { product_name -> { amount: string, rate: string, mode: 'amount'|'rate' } }
  const [inputs, setInputs] = useState<Record<string, { amount: string; rate: string; mode: 'amount' | 'rate' }>>({})

  async function load() {
    setLoading(true)
    const res  = await fetch('/api/products/master')
    const json = await res.json()
    const data: ProductMaster[] = json.data ?? []
    setProducts(data)

    // 既存値で inputs を初期化
    const init: typeof inputs = {}
    for (const p of data) {
      init[p.product_name] = {
        amount: p.cost_amount != null ? String(p.cost_amount) : '',
        rate:   p.cost_rate   != null ? String(p.cost_rate)   : '',
        mode:   p.cost_rate   != null ? 'rate' : 'amount',
      }
    }
    setInputs(init)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function handleSave(productName: string) {
    const inp = inputs[productName]
    if (!inp) return

    const isRate   = inp.mode === 'rate'
    const rawVal   = isRate ? inp.rate : inp.amount
    const numVal   = parseFloat(rawVal)
    if (!rawVal || isNaN(numVal) || numVal < 0) {
      alert('正しい数値を入力してください')
      return
    }

    setSaving(productName)
    const body: Record<string, unknown> = { product_name: productName }
    if (isRate) body.cost_rate   = numVal
    else        body.cost_amount = Math.round(numVal)

    const res = await fetch('/api/products/master', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })
    setSaving(null)
    if (res.ok) await load()
    else alert('保存に失敗しました')
  }

  const unregistered = products.filter(p => p.cost_amount == null && p.cost_rate == null)
  const registered   = products.filter(p => p.cost_amount != null || p.cost_rate != null)

  if (loading) return <p className="text-gray-400">読み込み中...</p>

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">原価マスタ管理</h1>
      <p className="text-sm text-gray-500 mb-8">
        商品ごとの原価を登録してください。原価額（円）または原価率（%）のいずれかで入力できます。<br />
        原価を変更した場合、変更前の値は履歴に保存されます。
      </p>

      {/* 未登録セクション */}
      {unregistered.length > 0 && (
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2 py-1 rounded-full">
              要登録 {unregistered.length}件
            </span>
            <h2 className="text-lg font-semibold text-gray-700">原価未登録の商品</h2>
          </div>
          <div className="space-y-3">
            {unregistered.map(p => (
              <ProductRow
                key={p.product_name}
                product={p}
                input={inputs[p.product_name] ?? { amount: '', rate: '', mode: 'amount' }}
                onInputChange={(field, val) =>
                  setInputs(prev => ({
                    ...prev,
                    [p.product_name]: { ...prev[p.product_name], [field]: val },
                  }))
                }
                onSave={() => handleSave(p.product_name)}
                saving={saving === p.product_name}
                highlight
              />
            ))}
          </div>
        </section>
      )}

      {/* 登録済みセクション */}
      {registered.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-gray-700 mb-4">登録済みの商品（{registered.length}件）</h2>
          <div className="space-y-2">
            {registered.map(p => (
              <ProductRow
                key={p.product_name}
                product={p}
                input={inputs[p.product_name] ?? { amount: '', rate: '', mode: 'amount' }}
                onInputChange={(field, val) =>
                  setInputs(prev => ({
                    ...prev,
                    [p.product_name]: { ...prev[p.product_name], [field]: val },
                  }))
                }
                onSave={() => handleSave(p.product_name)}
                saving={saving === p.product_name}
                highlight={false}
              />
            ))}
          </div>
        </section>
      )}

      {products.length === 0 && (
        <div className="text-center text-gray-400 py-20">
          <p className="text-5xl mb-4">📦</p>
          <p>商品がまだ登録されていません。</p>
          <p className="text-sm mt-1">CSVをアップロードすると商品が自動で追加されます。</p>
          <a href="/upload" className="inline-block mt-4 text-blue-600 underline text-sm">
            CSVをアップロードする →
          </a>
        </div>
      )}
    </div>
  )
}

// ---- 商品行コンポーネント ----
interface ProductRowProps {
  product:       ProductMaster
  input:         { amount: string; rate: string; mode: 'amount' | 'rate' }
  onInputChange: (field: string, val: string) => void
  onSave:        () => void
  saving:        boolean
  highlight:     boolean
}

function ProductRow({ product, input, onInputChange, onSave, saving, highlight }: ProductRowProps) {
  const p = product

  const costLabel = p.cost_amount != null
    ? `${p.cost_amount.toLocaleString()} 円`
    : p.cost_rate != null
    ? `${p.cost_rate} %`
    : null

  return (
    <div className={`bg-white rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center gap-3
      ${highlight ? 'border-amber-300 bg-amber-50' : 'border-gray-200'}`}>

      {/* 商品名 */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-gray-800 truncate">{p.product_name}</p>
        {costLabel && (
          <p className="text-xs text-gray-400 mt-0.5">現在の原価：{costLabel}</p>
        )}
      </div>

      {/* 入力モード切替 */}
      <div className="flex items-center gap-1 text-sm">
        <button
          onClick={() => onInputChange('mode', 'amount')}
          className={`px-3 py-1 rounded-l-lg border ${input.mode === 'amount'
            ? 'bg-blue-600 text-white border-blue-600'
            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
          円
        </button>
        <button
          onClick={() => onInputChange('mode', 'rate')}
          className={`px-3 py-1 rounded-r-lg border-t border-b border-r ${input.mode === 'rate'
            ? 'bg-blue-600 text-white border-blue-600'
            : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}>
          %
        </button>
      </div>

      {/* 入力フォーム */}
      <div className="flex items-center gap-2">
        <input
          type="number"
          min="0"
          step={input.mode === 'rate' ? '0.1' : '1'}
          value={input.mode === 'amount' ? input.amount : input.rate}
          onChange={e => onInputChange(input.mode === 'amount' ? 'amount' : 'rate', e.target.value)}
          placeholder={input.mode === 'amount' ? '例: 150' : '例: 35.0'}
          className="w-28 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <span className="text-sm text-gray-500">{input.mode === 'amount' ? '円' : '%'}</span>
        <button
          onClick={onSave}
          disabled={saving}
          className="bg-blue-600 text-white rounded-lg px-4 py-1.5 text-sm hover:bg-blue-700 disabled:opacity-40 whitespace-nowrap">
          {saving ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  )
}
