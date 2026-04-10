'use client'

import { useState, useEffect } from 'react'

interface Location {
  id: string; name: string; address: string
  latitude: number | null; longitude: number | null
  created_at: string
}

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading]     = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult]         = useState<string | null>(null)
  const [error, setError]           = useState<string | null>(null)

  const [form, setForm] = useState({
    name: '', address: '', event_name: '', log_date: new Date().toISOString().slice(0, 10),
  })

  async function loadLocations() {
    const res  = await fetch('/api/locations')
    const json = await res.json()
    setLocations(json.data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadLocations() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.address) return
    setSubmitting(true)
    setResult(null)
    setError(null)

    const res  = await fetch('/api/locations', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(form),
    })
    const json = await res.json()
    setSubmitting(false)

    if (!res.ok) {
      setError(json.error ?? '登録に失敗しました')
      return
    }

    const w = json.weather
    setResult(
      `登録完了！ 座標取得: ${json.geocoded?.slice(0, 40)}... ` +
      (w ? `/ 天候: ${w.weather_type}（${w.temperature_max}℃ / ${w.temperature_min}℃）` : '/ 天候: 取得できませんでした')
    )
    setForm({ name: '', address: '', event_name: '', log_date: new Date().toISOString().slice(0, 10) })
    loadLocations()
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`「${name}」を削除しますか？`)) return
    await fetch(`/api/locations/${id}`, { method: 'DELETE' })
    loadLocations()
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-8">出店ログ管理</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 登録フォーム */}
        <div>
          <h2 className="text-lg font-semibold text-gray-700 mb-4">新規出店ログ登録</h2>
          <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">出店日 *</label>
              <input type="date" required
                value={form.log_date}
                onChange={e => setForm(f => ({ ...f, log_date: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">場所名 *</label>
              <input type="text" required placeholder="例: 代々木公園 北エリア"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">住所 *</label>
              <input type="text" required placeholder="例: 東京都渋谷区代々木神園町2-1"
                value={form.address}
                onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
              <p className="text-xs text-gray-400 mt-1">住所から自動で座標・天候を取得します</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">イベント名（任意）</label>
              <input type="text" placeholder="例: 代々木フードフェスタ2026"
                value={form.event_name}
                onChange={e => setForm(f => ({ ...f, event_name: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>

            {error  && <p className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</p>}
            {result && <p className="text-green-700 text-sm bg-green-50 p-3 rounded-lg">{result}</p>}

            <button type="submit" disabled={submitting}
              className="w-full bg-blue-600 text-white rounded-xl py-2.5 font-semibold hover:bg-blue-700 disabled:opacity-40 transition">
              {submitting ? '登録中（座標・天候取得中）...' : '登録する'}
            </button>
          </form>
        </div>

        {/* 登録済み一覧 */}
        <div>
          <h2 className="text-lg font-semibold text-gray-700 mb-4">
            登録済み出店場所（{locations.length}件）
          </h2>
          {loading ? (
            <p className="text-gray-400 text-sm">読み込み中...</p>
          ) : locations.length === 0 ? (
            <p className="text-gray-400 text-sm">まだ登録されていません</p>
          ) : (
            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {locations.map(loc => (
                <div key={loc.id}
                  className="bg-white rounded-xl border border-gray-200 p-4 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 truncate">{loc.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{loc.address}</p>
                    {loc.latitude && (
                      <p className="text-xs text-gray-300 mt-0.5">
                        {loc.latitude.toFixed(4)}, {loc.longitude?.toFixed(4)}
                      </p>
                    )}
                  </div>
                  <button onClick={() => handleDelete(loc.id, loc.name)}
                    className="text-xs text-red-400 hover:text-red-600 whitespace-nowrap mt-0.5">
                    削除
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
