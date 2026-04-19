'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { fetchApi } from '@/lib/api-client'
import type {
  VendorWeeklyReportFeedbackPayload,
  VendorWeeklyReportGeneratePayload,
} from '@/types/api-payloads'
import type {
  VendorDailyMemo,
  VendorDailySalesRow,
  VendorWeekRange,
  VendorWeeklyReport,
} from '@/types/operations'

function fmtYen(value: number) {
  return `${value.toLocaleString('ja-JP')} 円`
}

type Props = {
  rows: VendorDailySalesRow[]
  memos: VendorDailyMemo[]
  weeklyReports: VendorWeeklyReport[]
  weeks: VendorWeekRange[]
}

export default function WeeklyReportsClient({
  rows,
  memos,
  weeklyReports: initialReports,
  weeks,
}: Props) {
  const router = useRouter()
  const [reports, setReports] = useState(initialReports)
  const [generatingWeek, setGeneratingWeek] = useState<string | null>(null)
  const [reportError, setReportError] = useState<string | null>(null)

  const memoMap = useMemo(
    () => new Map(memos.map((item) => [item.memo_date, item.memo_text])),
    [memos]
  )

  const reportMap = useMemo(
    () =>
      new Map<string, VendorWeeklyReport>(
        reports.map((item) => [`${item.week_start_date}__${item.week_end_date}`, item])
      ),
    [reports]
  )

  const weeklyStatsMap = useMemo(() => {
    const map = new Map<string, { sales: number; txnCount: number; memoCount: number }>()

    for (const week of weeks) {
      const rowsInWeek = rows.filter((row) => row.date >= week.start && row.date <= week.end)
      const memoCount = rowsInWeek.filter((row) => (memoMap.get(row.date) ?? '').trim()).length

      map.set(`${week.start}__${week.end}`, {
        sales: rowsInWeek.reduce((sum, row) => sum + row.sales, 0),
        txnCount: rowsInWeek.reduce((sum, row) => sum + row.txnCount, 0),
        memoCount,
      })
    }

    return map
  }, [memoMap, rows, weeks])

  async function handleGenerateReport(week: VendorWeekRange) {
    setGeneratingWeek(`${week.start}__${week.end}`)
    setReportError(null)

    try {
      const data = await fetchApi<VendorWeeklyReportGeneratePayload>('/api/vendor/weekly-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          week_start_date: week.start,
          week_end_date: week.end,
        }),
      })

      setReports((prev) => {
        const next = prev.filter(
          (item) => !(item.week_start_date === week.start && item.week_end_date === week.end)
        )
        next.push(data)
        next.sort((a, b) => a.week_start_date.localeCompare(b.week_start_date))
        return next
      })
      router.refresh()
    } catch (error: any) {
      setReportError(error.message ?? 'AI週報の作成に失敗しました')
    } finally {
      setGeneratingWeek(null)
    }
  }

  async function handleHelpful(reportId: string, helpful: boolean) {
    try {
      const data = await fetchApi<VendorWeeklyReportFeedbackPayload>(
        `/api/vendor/weekly-reports/${reportId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ helpful_feedback: helpful }),
        }
      )

      setReports((prev) => prev.map((item) => (item.id === reportId ? data : item)))
      router.refresh()
    } catch (error: any) {
      setReportError(error.message ?? '評価の保存に失敗しました')
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">AI週報</h2>
            <p className="mt-1 text-sm text-gray-500">
              営業メモと売上成績をもとに、週ごとのふり返りと客観的なフィードバックを作成します。
            </p>
          </div>
          {reportError && <p className="text-sm text-red-600">{reportError}</p>}
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {weeks.map((week) => {
            const key = `${week.start}__${week.end}`
            const report = reportMap.get(key)
            const stats = weeklyStatsMap.get(key) ?? { sales: 0, txnCount: 0, memoCount: 0 }

            return (
              <div key={key} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{week.label}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      売上 {fmtYen(stats.sales)} / 取引数 {stats.txnCount.toLocaleString('ja-JP')} 件 / メモ {stats.memoCount} 件
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleGenerateReport(week)}
                    disabled={generatingWeek === key || stats.txnCount === 0}
                    className="rounded-full bg-[var(--accent-blue)] px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {generatingWeek === key ? '作成中...' : report ? '週報を更新' : 'AI週報を作成'}
                  </button>
                </div>

                {report ? (
                  <div className="mt-4 space-y-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{report.report_title}</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-gray-600">
                        {report.weekly_summary}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                      <p className="text-sm font-semibold text-blue-900">AIからの客観フィードバック</p>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-blue-900">
                        {report.ai_feedback}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-gray-600">このフィードバックは参考になりましたか？</span>
                      <button
                        type="button"
                        onClick={() => handleHelpful(report.id, true)}
                        className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                          report.helpful_feedback === true
                            ? 'bg-emerald-600 text-white'
                            : 'bg-white text-emerald-700 ring-1 ring-emerald-200'
                        }`}
                      >
                        参考になった
                      </button>
                      <button
                        type="button"
                        onClick={() => handleHelpful(report.id, false)}
                        className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                          report.helpful_feedback === false
                            ? 'bg-amber-500 text-white'
                            : 'bg-white text-amber-700 ring-1 ring-amber-200'
                        }`}
                      >
                        まだ判断中
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-gray-200 bg-white p-4 text-sm text-gray-500">
                    この週の営業メモが入っていると、より具体的な週報とフィードバックになります。
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
