'use client'

import { useEffect, useMemo, useState } from 'react'

type DimensionKey = 'location' | 'weekday' | 'weather' | 'hour' | 'product'
type MetricKey =
  | 'sales'
  | 'txn_count'
  | 'avg_ticket'
  | 'gross_profit'
  | 'gross_profit_rate'

type Preset = {
  id: string
  name: string
  dimensions: DimensionKey[]
  metrics: MetricKey[]
}

const DIMENSIONS: Array<{ key: DimensionKey; label: string }> = [
  { key: 'location', label: '場所' },
  { key: 'weekday', label: '曜日' },
  { key: 'weather', label: '天候' },
  { key: 'hour', label: '時間帯' },
  { key: 'product', label: '商品' },
]

const METRICS: Array<{ key: MetricKey; label: string }> = [
  { key: 'sales', label: '売上' },
  { key: 'txn_count', label: '取引数' },
  { key: 'avg_ticket', label: '平均取引単価' },
  { key: 'gross_profit', label: '推定粗利' },
  { key: 'gross_profit_rate', label: '推定粗利率' },
]

function fmtMetric(metric: MetricKey, value: number) {
  if (metric === 'gross_profit_rate') return `${value.toFixed(1)}%`
  return value.toLocaleString('ja-JP')
}

export default function CrossAnalyticsClient() {
  const [dimensions, setDimensions] = useState<DimensionKey[]>(['location', 'weekday'])
  const [metrics, setMetrics] = useState<MetricKey[]>(['sales', 'txn_count', 'avg_ticket'])
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [draggingDimension, setDraggingDimension] = useState<DimensionKey | null>(null)
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [presetName, setPresetName] = useState('')
  const [presets, setPresets] = useState<Preset[]>([])

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('cross-analytics-presets')
      if (saved) {
        setPresets(JSON.parse(saved))
      }
    } catch {
      // noop
    }
  }, [])

  useEffect(() => {
    fetchAnalytics()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchAnalytics(nextDimensions = dimensions, nextMetrics = metrics) {
    if (nextDimensions.length === 0) {
      setRows([])
      setError('分析軸を1つ以上選んでください')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const res = await fetch('/api/analytics/cross', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dimensions: nextDimensions,
          metrics: nextMetrics,
          start: start || undefined,
          end: end || undefined,
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'クロス分析の取得に失敗しました')
        return
      }

      setRows(json.rows ?? [])
    } catch {
      setError('クロス分析の取得に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  function handleDrop(index: number) {
    if (!draggingDimension) return

    setDimensions((prev) => {
      const next = [...prev]
      if (next.includes(draggingDimension)) {
        const currentIndex = next.indexOf(draggingDimension)
        next.splice(currentIndex, 1)
      }

      next.splice(index, 0, draggingDimension)
      const normalized = next.slice(0, 2)
      fetchAnalytics(normalized, metrics)
      return normalized
    })
    setDraggingDimension(null)
  }

  function removeDimension(key: DimensionKey) {
    const next = dimensions.filter((dimension) => dimension !== key)
    setDimensions(next)
    fetchAnalytics(next, metrics)
  }

  function toggleMetric(metric: MetricKey) {
    const next = metrics.includes(metric)
      ? metrics.filter((item) => item !== metric)
      : [...metrics, metric]

    setMetrics(next)
    fetchAnalytics(dimensions, next)
  }

  function savePreset() {
    if (!presetName.trim()) {
      setError('プリセット名を入力してください')
      return
    }

    const nextPreset: Preset = {
      id: `${Date.now()}`,
      name: presetName.trim(),
      dimensions,
      metrics,
    }

    const nextPresets = [nextPreset, ...presets]
    setPresets(nextPresets)
    setPresetName('')
    window.localStorage.setItem('cross-analytics-presets', JSON.stringify(nextPresets))
  }

  function applyPreset(preset: Preset) {
    setDimensions(preset.dimensions)
    setMetrics(preset.metrics)
    fetchAnalytics(preset.dimensions, preset.metrics)
  }

  const dimensionLabels = useMemo(
    () => new Map(DIMENSIONS.map((dimension) => [dimension.key, dimension.label])),
    []
  )

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="mb-3 text-sm font-semibold text-gray-700">分析軸をドラッグして配置</p>
            <div className="mb-4 flex flex-wrap gap-2">
              {DIMENSIONS.map((dimension) => (
                <button
                  key={dimension.key}
                  type="button"
                  draggable
                  onDragStart={() => setDraggingDimension(dimension.key)}
                  className="rounded-full border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700"
                >
                  {dimension.label}
                </button>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {[0, 1].map((slot) => {
                const current = dimensions[slot]

                return (
                  <div
                    key={slot}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDrop(slot)}
                    className="min-h-[88px] rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4"
                  >
                    <p className="mb-2 text-xs text-gray-500">軸 {slot + 1}</p>
                    {current ? (
                      <div className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2">
                        <span className="font-medium text-gray-800">{dimensionLabels.get(current)}</span>
                        <button
                          type="button"
                          onClick={() => removeDimension(current)}
                          className="text-xs text-red-500"
                        >
                          外す
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">ここにドラッグ</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <p className="mb-3 text-sm font-semibold text-gray-700">期間フィルタ</p>
              <div className="flex flex-col gap-3 md:flex-row">
                <input
                  type="date"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <input
                  type="date"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => fetchAnalytics()}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
                >
                  反映
                </button>
              </div>
            </div>

            <div>
              <p className="mb-3 text-sm font-semibold text-gray-700">出力指標</p>
              <div className="flex flex-wrap gap-2">
                {METRICS.map((metric) => {
                  const selected = metrics.includes(metric.key)
                  return (
                    <button
                      key={metric.key}
                      type="button"
                      onClick={() => toggleMetric(metric.key)}
                      className={`rounded-full px-3 py-2 text-sm ${
                        selected
                          ? 'bg-blue-600 text-white'
                          : 'border border-gray-300 bg-white text-gray-700'
                      }`}
                    >
                      {metric.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <div>
              <p className="mb-3 text-sm font-semibold text-gray-700">プリセット保存</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="例: 場所×曜日の定点観測"
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={savePreset}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700"
                >
                  保存
                </button>
              </div>
              {presets.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {presets.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className="rounded-full bg-amber-50 px-3 py-2 text-sm text-amber-800"
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
        <table className="min-w-[980px] w-full border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-left text-gray-500">
              <th className="border-b border-gray-200 bg-gray-50 px-4 py-3 font-medium">
                {dimensionLabels.get(dimensions[0]) ?? '軸1'}
              </th>
              {dimensions[1] && (
                <th className="border-b border-gray-200 bg-gray-50 px-4 py-3 font-medium">
                  {dimensionLabels.get(dimensions[1])}
                </th>
              )}
              {metrics.map((metric) => (
                <th key={metric} className="border-b border-gray-200 bg-gray-50 px-4 py-3 font-medium">
                  {METRICS.find((item) => item.key === metric)?.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={2 + metrics.length}
                  className="px-4 py-10 text-center text-sm text-gray-500"
                >
                  集計中...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={2 + metrics.length}
                  className="px-4 py-10 text-center text-sm text-gray-500"
                >
                  条件に一致するデータがありません。
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={`${row.dimension_1}-${row.dimension_2 ?? 'none'}-${index}`}>
                  <td className="border-b border-gray-100 px-4 py-3 font-medium text-gray-800">
                    {row.dimension_1}
                  </td>
                  {dimensions[1] && (
                    <td className="border-b border-gray-100 px-4 py-3">
                      {row.dimension_2 ?? '-'}
                    </td>
                  )}
                  {metrics.map((metric) => (
                    <td key={metric} className="border-b border-gray-100 px-4 py-3">
                      {fmtMetric(metric, row[metric] ?? 0)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
