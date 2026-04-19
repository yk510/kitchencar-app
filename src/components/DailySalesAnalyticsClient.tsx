'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { fetchApi } from '@/lib/api-client'
import { getHolidayFlagTone, getWeekdayIndex } from '@/lib/calendar'
import { usePersistentDraft } from '@/lib/usePersistentDraft'
import type { VendorDailyMemoMutationPayload } from '@/types/api-payloads'
import type { VendorDailyMemo, VendorDailySalesRow } from '@/types/operations'

function fmtYen(value: number) {
  return `${value.toLocaleString('ja-JP')} 円`
}

type Props = {
  rows: VendorDailySalesRow[]
  memos: VendorDailyMemo[]
}

export default function DailySalesAnalyticsClient({
  rows,
  memos: initialMemos,
}: Props) {
  const [memos, setMemos] = useState(initialMemos)
  const [savingDate, setSavingDate] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const memoDraft = usePersistentDraft<Record<string, string>>(
    'draft:vendor-daily-memos',
    Object.fromEntries(initialMemos.map((item) => [item.memo_date, item.memo_text]))
  )
  const { setValue: setMemoDrafts, value: memoDrafts } = memoDraft

  useEffect(() => {
    setMemoDrafts((prev) => {
      const next = { ...prev }
      for (const memo of memos) {
        if (!(memo.memo_date in next) || !next[memo.memo_date]) {
          next[memo.memo_date] = memo.memo_text
        }
      }
      return next
    })
  }, [memos, setMemoDrafts])

  const memoMap = useMemo(
    () => new Map(memos.map((item) => [item.memo_date, item])),
    [memos]
  )

  async function handleSaveMemo(date: string) {
    setSavingDate(date)
    setSaveError(null)
    setSaveMessage(null)

    try {
      const data = await fetchApi<VendorDailyMemoMutationPayload>('/api/vendor/daily-memos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          memo_date: date,
          memo_text: memoDraft.value[date] ?? '',
          
        }),
      })

      setMemos((prev) => {
        const next = prev.filter((item) => item.memo_date !== date)
        next.push(data)
        next.sort((a, b) => a.memo_date.localeCompare(b.memo_date))
        return next
      })
      setSaveMessage(`${date} の営業メモを保存しました`)
    } catch (error: any) {
      setSaveError(error.message ?? '営業メモの保存に失敗しました')
    } finally {
      setSavingDate(null)
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">営業メモと週報</h2>
            <p className="mt-1 text-sm text-gray-500">
              日ごとの気づきはここに残して、週単位のふり返りとAIフィードバックは週報ページで確認できます。
            </p>
          </div>
          <Link
            href="/reports/weekly"
            className="rounded-full bg-[var(--accent-blue)] px-4 py-2 text-sm font-medium text-white"
          >
            週報を見る
          </Link>
        </div>
      </section>

      {saveMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {saveMessage}
        </div>
      )}

      {saveError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {saveError}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-20 text-center">
          <p className="text-gray-600">この期間の売上データはありません。</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-[1540px] w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="border-b border-gray-200 bg-gray-50 px-4 py-3 font-medium">日付</th>
                <th className="border-b border-gray-200 bg-gray-50 px-4 py-3 font-medium">曜日</th>
                <th className="border-b border-gray-200 bg-gray-50 px-4 py-3 font-medium">休祝日</th>
                <th className="border-b border-gray-200 bg-gray-50 px-4 py-3 font-medium">出店場所</th>
                <th className="border-b border-gray-200 bg-gray-50 px-4 py-3 font-medium">イベント名</th>
                <th className="border-b border-gray-200 bg-gray-50 px-4 py-3 font-medium">市町村</th>
                <th className="border-b border-gray-200 bg-gray-50 px-4 py-3 font-medium">天候</th>
                <th className="border-b border-gray-200 bg-gray-50 px-4 py-3 font-medium">平均気温</th>
                <th className="border-b border-gray-200 bg-gray-50 px-4 py-3 font-medium">当日の売上</th>
                <th className="border-b border-gray-200 bg-gray-50 px-4 py-3 font-medium">取引数</th>
                <th className="border-b border-gray-200 bg-gray-50 px-4 py-3 font-medium">平均取引単価</th>
                <th className="border-b border-gray-200 bg-gray-50 px-4 py-3 font-medium">当日の推定粗利</th>
                <th className="border-b border-gray-200 bg-gray-50 px-4 py-3 font-medium">営業メモ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const weekdayIndex = getWeekdayIndex(row.date)
                const rowTone =
                  weekdayIndex === 0
                    ? 'bg-rose-50'
                    : weekdayIndex === 6
                    ? 'bg-sky-50'
                    : 'bg-white'

                const memoValue = memoDrafts[row.date] ?? memoMap.get(row.date)?.memo_text ?? ''

                return (
                  <tr key={row.date} className={rowTone}>
                    <td className="border-b border-gray-100 px-4 py-3 font-medium text-gray-800">{row.date}</td>
                    <td className="border-b border-gray-100 px-4 py-3">{row.weekday}</td>
                    <td className="border-b border-gray-100 px-4 py-3">
                      {row.holidayFlag ? (
                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getHolidayFlagTone(row.holidayFlag)}`}>
                          {row.holidayFlag}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="border-b border-gray-100 px-4 py-3">{row.locationName}</td>
                    <td className="border-b border-gray-100 px-4 py-3">{row.eventName}</td>
                    <td className="border-b border-gray-100 px-4 py-3">{row.municipality}</td>
                    <td className="border-b border-gray-100 px-4 py-3">{row.weatherType}</td>
                    <td className="border-b border-gray-100 px-4 py-3">{row.avgTemperature}</td>
                    <td className="border-b border-gray-100 px-4 py-3 font-medium text-gray-800">{fmtYen(row.sales)}</td>
                    <td className="border-b border-gray-100 px-4 py-3">{row.txnCount.toLocaleString('ja-JP')}</td>
                    <td className="border-b border-gray-100 px-4 py-3">{fmtYen(row.avgTicket)}</td>
                    <td className="border-b border-gray-100 px-4 py-3 text-green-700">{fmtYen(row.grossProfit)}</td>
                    <td className="border-b border-gray-100 px-4 py-3 align-top">
                      <div className="w-[320px] space-y-2">
                        <textarea
                          value={memoValue}
                          onChange={(event) =>
                            setMemoDrafts((prev) => ({
                              ...prev,
                              [row.date]: event.target.value,
                            }))
                          }
                          rows={4}
                          className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700"
                          placeholder="気づき、反省点、売れた理由、次回試したいことを書いておくと、週報の精度が上がります。"
                        />
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs text-gray-400">
                            {memoMap.get(row.date)?.updated_at
                              ? `最終保存: ${memoMap.get(row.date)?.updated_at.slice(0, 16).replace('T', ' ')}`
                              : '未保存'}
                          </p>
                          <button
                            type="button"
                            onClick={() => handleSaveMemo(row.date)}
                            disabled={savingDate === row.date}
                            className="rounded-full bg-[var(--accent-blue)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                          >
                            {savingDate === row.date ? '保存中...' : '保存'}
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
