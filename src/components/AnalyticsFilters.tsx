'use client'

import { useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { AnalyticsScope } from '@/components/AnalyticsScopeTabs'

export default function AnalyticsFilters({
  basePath,
  currentScope,
  currentStart,
  currentEnd,
}: {
  basePath: string
  currentScope?: AnalyticsScope
  currentStart?: string
  currentEnd?: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [start, setStart] = useState(currentStart ?? '')
  const [end, setEnd] = useState(currentEnd ?? '')
  const [error, setError] = useState<string | null>(null)

  const hasChanged = useMemo(() => {
    return start !== (currentStart ?? '') || end !== (currentEnd ?? '')
  }, [start, end, currentStart, currentEnd])

  function applyFilters() {
    if (start && end && start > end) {
      setError('開始日は終了日以前にしてください')
      return
    }

    setError(null)

    const params = new URLSearchParams(searchParams.toString())

    if (currentScope) {
      params.set('scope', currentScope)
    }

    if (start) params.set('start', start)
    else params.delete('start')

    if (end) params.set('end', end)
    else params.delete('end')

    router.push(`${basePath}?${params.toString()}`)
  }

  function clearFilters() {
    setStart('')
    setEnd('')
    setError(null)

    const params = new URLSearchParams(searchParams.toString())

    if (currentScope) {
      params.set('scope', currentScope)
    }

    params.delete('start')
    params.delete('end')

    router.push(`${basePath}?${params.toString()}`)
  }

  return (
    <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-sm font-semibold text-gray-700 mb-3">期間指定</p>

      <div className="flex flex-col md:flex-row md:items-end gap-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">開始日</label>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">終了日</label>
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={applyFilters}
            disabled={!hasChanged}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-40"
          >
            適用
          </button>

          <button
            onClick={clearFilters}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            クリア
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
          {error}
        </p>
      )}
    </div>
  )
}