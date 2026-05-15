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

const COLUMN_OPTIONS = [
  { key: 'weekday', label: '曜日' },
  { key: 'holidayFlag', label: '休祝日' },
  { key: 'locationName', label: '出店場所' },
  { key: 'eventName', label: 'イベント名' },
  { key: 'municipality', label: '市町村' },
  { key: 'weatherType', label: '天候' },
  { key: 'avgTemperature', label: '平均気温' },
  { key: 'sales', label: '全体売上額' },
  { key: 'txnCount', label: '会計数' },
  { key: 'avgTicket', label: '会計単価' },
  { key: 'itemCount', label: '商品数' },
  { key: 'avgItemPrice', label: '商品単価' },
  { key: 'cashSales', label: '現金売上' },
  { key: 'paypaySales', label: 'PayPay売上' },
  { key: 'otherSales', label: 'その他売上' },
  { key: 'grossProfit', label: '当日の推定粗利' },
  { key: 'memo', label: '営業メモ' },
] as const

const DEFAULT_VISIBLE_COLUMNS = Object.fromEntries(
  COLUMN_OPTIONS.map((column) => [column.key, true])
) as Record<(typeof COLUMN_OPTIONS)[number]['key'], boolean>

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
  const visibleColumnsDraft = usePersistentDraft<Record<string, boolean>>(
    'draft:vendor-daily-sales-columns',
    DEFAULT_VISIBLE_COLUMNS
  )
  const { value: visibleColumns, setValue: setVisibleColumns } = visibleColumnsDraft

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

  const summary = useMemo(() => {
    const totalSales = rows.reduce((sum, row) => sum + row.sales, 0)
    const totalTxns = rows.reduce((sum, row) => sum + row.txnCount, 0)
    const totalItems = rows.reduce((sum, row) => sum + row.itemCount, 0)
    return {
      totalSales,
      totalTxns,
      totalItems,
      avgTicket: totalTxns > 0 ? Math.round(totalSales / totalTxns) : 0,
      avgItemPrice: totalItems > 0 ? Math.round(totalSales / totalItems) : 0,
    }
  }, [rows])

  const activeColumns = useMemo(
    () => COLUMN_OPTIONS.filter((column) => visibleColumns[column.key] !== false),
    [visibleColumns]
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
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-3xl border border-[var(--line-soft)] bg-white px-5 py-4">
          <p className="text-xs text-sub">期間売上</p>
          <p className="mt-2 text-2xl font-bold text-main">{fmtYen(summary.totalSales)}</p>
        </div>
        <div className="rounded-3xl border border-[var(--line-soft)] bg-white px-5 py-4">
          <p className="text-xs text-sub">会計数</p>
          <p className="mt-2 text-2xl font-bold text-main">{summary.totalTxns.toLocaleString('ja-JP')} 件</p>
        </div>
        <div className="rounded-3xl border border-[var(--line-soft)] bg-white px-5 py-4">
          <p className="text-xs text-sub">会計単価</p>
          <p className="mt-2 text-2xl font-bold text-main">{fmtYen(summary.avgTicket)}</p>
        </div>
        <div className="rounded-3xl border border-[var(--line-soft)] bg-white px-5 py-4">
          <p className="text-xs text-sub">商品数</p>
          <p className="mt-2 text-2xl font-bold text-main">{summary.totalItems.toLocaleString('ja-JP')} 点</p>
        </div>
        <div className="rounded-3xl border border-[var(--line-soft)] bg-white px-5 py-4">
          <p className="text-xs text-sub">商品単価</p>
          <p className="mt-2 text-2xl font-bold text-main">{fmtYen(summary.avgItemPrice)}</p>
        </div>
      </section>

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

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">表示カラム</h2>
            <p className="mt-1 text-sm text-gray-500">
              日別の確認に必要な指標だけを表示できます。設定はこの端末に保存されます。
            </p>
          </div>
          <button
            type="button"
            onClick={() => setVisibleColumns(DEFAULT_VISIBLE_COLUMNS)}
            className="rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600"
          >
            初期表示に戻す
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {COLUMN_OPTIONS.map((column) => {
            const active = visibleColumns[column.key] !== false
            return (
              <button
                key={column.key}
                type="button"
                onClick={() =>
                  setVisibleColumns((prev) => ({
                    ...prev,
                    [column.key]: !(prev[column.key] !== false),
                  }))
                }
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  active
                    ? 'bg-[var(--accent-blue)] text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {column.label}
              </button>
            )
          })}
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
          <table className="min-w-[1780px] w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="border-b border-gray-200 bg-gray-50 px-4 py-3 font-medium">日付</th>
                {visibleColumns.weekday !== false && (
                  <th className="border-b border-gray-200 bg-gray-50 px-4 py-3 font-medium">曜日</th>
                )}
                {visibleColumns.holidayFlag !== false && (
                  <th className="border-b border-gray-200 bg-gray-50 px-4 py-3 font-medium">休祝日</th>
                )}
                {visibleColumns.locationName !== false && (
                  <th className="border-b border-gray-200 bg-gray-50 px-4 py-3 font-medium">出店場所</th>
                )}
                {visibleColumns.eventName !== false && (
                  <th className="border-b border-gray-200 bg-gray-50 px-4 py-3 font-medium">イベント名</th>
                )}
                {visibleColumns.municipality !== false && (
                  <th className="border-b border-gray-200 bg-gray-50 px-4 py-3 font-medium">市町村</th>
                )}
                {visibleColumns.weatherType !== false && (
                  <th className="border-b border-gray-200 bg-gray-50 px-4 py-3 font-medium">天候</th>
                )}
                {visibleColumns.avgTemperature !== false && (
                  <th className="border-b border-gray-200 bg-gray-50 px-4 py-3 font-medium">平均気温</th>
                )}
                {visibleColumns.sales !== false && (
                  <th className="border-b border-gray-200 bg-gray-50 px-4 py-3 font-medium">全体売上額</th>
                )}
                {visibleColumns.txnCount !== false && (
                  <th className="border-b border-gray-200 bg-gray-50 px-4 py-3 font-medium">会計数</th>
                )}
                {visibleColumns.avgTicket !== false && (
                  <th className="border-b border-gray-200 bg-gray-50 px-4 py-3 font-medium">会計単価</th>
                )}
                {visibleColumns.itemCount !== false && (
                  <th className="border-b border-gray-200 bg-gray-50 px-4 py-3 font-medium">商品数</th>
                )}
                {visibleColumns.avgItemPrice !== false && (
                  <th className="border-b border-gray-200 bg-gray-50 px-4 py-3 font-medium">商品単価</th>
                )}
                {visibleColumns.cashSales !== false && (
                  <th className="border-b border-gray-200 bg-gray-50 px-4 py-3 font-medium">現金売上</th>
                )}
                {visibleColumns.paypaySales !== false && (
                  <th className="border-b border-gray-200 bg-gray-50 px-4 py-3 font-medium">PayPay売上</th>
                )}
                {visibleColumns.otherSales !== false && (
                  <th className="border-b border-gray-200 bg-gray-50 px-4 py-3 font-medium">その他売上</th>
                )}
                {visibleColumns.grossProfit !== false && (
                  <th className="border-b border-gray-200 bg-gray-50 px-4 py-3 font-medium">当日の推定粗利</th>
                )}
                {visibleColumns.memo !== false && (
                  <th className="border-b border-gray-200 bg-gray-50 px-4 py-3 font-medium">営業メモ</th>
                )}
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
                    {visibleColumns.weekday !== false && (
                      <td className="border-b border-gray-100 px-4 py-3">{row.weekday}</td>
                    )}
                    {visibleColumns.holidayFlag !== false && (
                      <td className="border-b border-gray-100 px-4 py-3">
                        {row.holidayFlag ? (
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getHolidayFlagTone(row.holidayFlag)}`}>
                            {row.holidayFlag}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    )}
                    {visibleColumns.locationName !== false && (
                      <td className="border-b border-gray-100 px-4 py-3">{row.locationName}</td>
                    )}
                    {visibleColumns.eventName !== false && (
                      <td className="border-b border-gray-100 px-4 py-3">{row.eventName}</td>
                    )}
                    {visibleColumns.municipality !== false && (
                      <td className="border-b border-gray-100 px-4 py-3">{row.municipality}</td>
                    )}
                    {visibleColumns.weatherType !== false && (
                      <td className="border-b border-gray-100 px-4 py-3">{row.weatherType}</td>
                    )}
                    {visibleColumns.avgTemperature !== false && (
                      <td className="border-b border-gray-100 px-4 py-3">{row.avgTemperature}</td>
                    )}
                    {visibleColumns.sales !== false && (
                      <td className="border-b border-gray-100 px-4 py-3 font-medium text-gray-800">{fmtYen(row.sales)}</td>
                    )}
                    {visibleColumns.txnCount !== false && (
                      <td className="border-b border-gray-100 px-4 py-3">{row.txnCount.toLocaleString('ja-JP')}</td>
                    )}
                    {visibleColumns.avgTicket !== false && (
                      <td className="border-b border-gray-100 px-4 py-3">{fmtYen(row.avgTicket)}</td>
                    )}
                    {visibleColumns.itemCount !== false && (
                      <td className="border-b border-gray-100 px-4 py-3">{row.itemCount.toLocaleString('ja-JP')}</td>
                    )}
                    {visibleColumns.avgItemPrice !== false && (
                      <td className="border-b border-gray-100 px-4 py-3">{fmtYen(row.avgItemPrice)}</td>
                    )}
                    {visibleColumns.cashSales !== false && (
                      <td className="border-b border-gray-100 px-4 py-3">{fmtYen(row.cashSales)}</td>
                    )}
                    {visibleColumns.paypaySales !== false && (
                      <td className="border-b border-gray-100 px-4 py-3">{fmtYen(row.paypaySales)}</td>
                    )}
                    {visibleColumns.otherSales !== false && (
                      <td className="border-b border-gray-100 px-4 py-3">{fmtYen(row.otherSales)}</td>
                    )}
                    {visibleColumns.grossProfit !== false && (
                      <td className="border-b border-gray-100 px-4 py-3 text-green-700">{fmtYen(row.grossProfit)}</td>
                    )}
                    {visibleColumns.memo !== false && (
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
                    )}
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
