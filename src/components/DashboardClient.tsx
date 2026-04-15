'use client'

import { useEffect, useMemo, useState } from 'react'
import DashboardPanelPicker from '@/components/DashboardPanelPicker'
import {
  DASHBOARD_PANEL_STORAGE_KEY,
  DEFAULT_VISIBLE_PANELS,
  type DashboardPanelId,
} from '@/lib/dashboardPanels'

type DashboardData = {
  todaySales: number
  monthSales: number
  todayTxnCount: number
  monthTxnCount: number
  avgTicket: number
  monthGrossProfit: number
  monthGrossMargin: number
  top3: [string, number][]
  unregisteredCount: number
  unregisteredNames: string[]
  unmatchedDates: string[]
  tasks: { label: string; href: string; tone: 'danger' | 'warn' }[]
  bestDay: { date: string; total: number; locationLabel: string } | null
  worstDay: { date: string; total: number; locationLabel: string } | null
  bestLocation: { name: string; dayCount: number; avgSales: number } | null
  worstLocation: { name: string; dayCount: number; avgSales: number } | null
}

function fmtYen(n: number) {
  return n.toLocaleString('ja-JP') + ' 円'
}

export default function DashboardClient({ data }: { data: DashboardData }) {
  const [visiblePanels, setVisiblePanels] = useState<DashboardPanelId[]>(DEFAULT_VISIBLE_PANELS)
  const [showPicker, setShowPicker] = useState(false)

  useEffect(() => {
    const raw = localStorage.getItem(DASHBOARD_PANEL_STORAGE_KEY)
    if (!raw) return

    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        setVisiblePanels(parsed)
      }
    } catch {}
  }, [])

  useEffect(() => {
    localStorage.setItem(
      DASHBOARD_PANEL_STORAGE_KEY,
      JSON.stringify(visiblePanels)
    )
  }, [visiblePanels])

  function togglePanel(id: DashboardPanelId) {
    setVisiblePanels((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  function resetPanels() {
    setVisiblePanels(DEFAULT_VISIBLE_PANELS)
  }

  function isVisible(id: DashboardPanelId) {
    return visiblePanels.includes(id)
  }

  const shouldShowAvgTicket = useMemo(() => data.monthTxnCount > 0, [data.monthTxnCount])

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="badge-blue badge-soft inline-block mb-3">HOME</div>
          <h1 className="section-title text-3xl font-bold mb-2">ダッシュボード</h1>
          <p className="section-subtitle text-sm">
            今日の状況と、次にやることをひと目で確認できます。
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowPicker((v) => !v)}
          className="soft-button bg-white border border-soft px-4 py-2 text-sm font-medium text-main shadow-sm"
        >
          {showPicker ? '表示設定を閉じる' : '表示項目を選ぶ'}
        </button>
      </div>

      {showPicker && (
        <DashboardPanelPicker
          visiblePanels={visiblePanels}
          onToggle={togglePanel}
          onReset={resetPanels}
        />
      )}

      {isVisible('today_tasks') && data.tasks.length > 0 && (
        <div className="soft-panel p-5 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">📝</span>
            <h2 className="section-title text-lg font-semibold">今日やること</h2>
          </div>

          <div className="space-y-3">
            {data.tasks.map((task, i) => (
              <a
                key={task.label}
                href={task.href}
                className={`block rounded-2xl border px-4 py-3 hover:opacity-90 transition ${
                  task.tone === 'danger'
                    ? 'bg-red-50 border-red-200 text-red-800'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                        task.tone === 'danger'
                          ? 'bg-red-200 text-red-900'
                          : 'bg-amber-200 text-amber-900'
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium">{task.label}</span>
                  </div>
                  <span className="text-xs font-semibold">開く →</span>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {isVisible('missing_costs') && data.unregisteredCount > 0 && (
        <div className="alert-warn p-5 mb-6">
          <p className="font-bold text-amber-800 mb-2">
            原価未登録の商品があります（{data.unregisteredCount}件）
          </p>
          <p className="text-sm text-amber-700 mb-3 break-words">
            {data.unregisteredNames.join(', ')}
          </p>
          <a
            href="/products/master"
            className="soft-button inline-block text-sm bg-amber-500 text-white rounded-full px-4 py-2 hover:bg-amber-600 shadow-sm"
          >
            原価マスタへ →
          </a>
        </div>
      )}

      {isVisible('missing_stall_logs') && data.unmatchedDates.length > 0 && (
        <div className="alert-warn p-5 mb-6">
          <p className="font-bold text-amber-800 mb-2">
            出店ログ未登録の日付があります（{data.unmatchedDates.length}日）
          </p>
          <p className="text-sm text-amber-700 mb-3 break-words">
            {data.unmatchedDates.join(', ')}
          </p>
          <a
            href="/stall-logs"
            className="soft-button inline-block text-sm bg-amber-500 text-white rounded-full px-4 py-2 hover:bg-amber-600 shadow-sm"
          >
            出店ログ管理へ →
          </a>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {isVisible('today_sales') && (
          <div className="kpi-card p-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">☀️</span>
              <p className="text-sm text-sub">本日の売上</p>
            </div>
            <p className="text-3xl font-bold text-blue-700">{fmtYen(data.todaySales)}</p>
          </div>
        )}

        {isVisible('month_sales') && (
          <div className="kpi-card p-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">📅</span>
              <p className="text-sm text-sub">今月の売上</p>
            </div>
            <p className="text-3xl font-bold text-blue-700">{fmtYen(data.monthSales)}</p>
          </div>
        )}

        {isVisible('today_txn_count') && (
          <div className="kpi-card p-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🧾</span>
              <p className="text-sm text-sub">本日の取引数</p>
            </div>
            <p className="text-3xl font-bold text-main">{data.todayTxnCount} 件</p>
          </div>
        )}

        {isVisible('month_txn_count') && (
          <div className="kpi-card p-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">📦</span>
              <p className="text-sm text-sub">今月の取引数</p>
            </div>
            <p className="text-3xl font-bold text-main">{data.monthTxnCount} 件</p>
          </div>
        )}

        {isVisible('avg_ticket') && shouldShowAvgTicket && (
          <div className="kpi-card p-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">💴</span>
              <p className="text-sm text-sub">平均取引単価</p>
            </div>
            <p className="text-3xl font-bold text-blue-700">{fmtYen(data.avgTicket)}</p>
          </div>
        )}

        {isVisible('month_gross_profit') && (
          <div className="kpi-card p-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">💚</span>
              <p className="text-sm text-sub">今月の推定粗利</p>
            </div>
            <p
              className={`text-3xl font-bold ${
                data.monthGrossProfit >= 0 ? 'text-green-700' : 'text-red-600'
              }`}
            >
              {fmtYen(data.monthGrossProfit)}
            </p>
          </div>
        )}

        {isVisible('month_gross_margin') && (
          <div className="kpi-card p-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">📈</span>
              <p className="text-sm text-sub">今月の粗利率</p>
            </div>
            <p className="text-3xl font-bold text-blue-700">
              {data.monthGrossMargin.toLocaleString()}%
            </p>
          </div>
        )}
      </div>

      {(isVisible('best_day') || isVisible('best_location')) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {isVisible('best_day') && (
            <div className="soft-card p-5 bg-green-50 border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">🌟</span>
                <p className="text-sm text-green-700">今月のベスト日</p>
              </div>
              {data.bestDay ? (
                <>
                  <p className="text-lg font-bold text-green-800">{data.bestDay.date}</p>
                  <p className="text-sm text-green-700 mb-1">{data.bestDay.locationLabel}</p>
                  <p className="text-2xl font-bold text-green-900">{fmtYen(data.bestDay.total)}</p>
                </>
              ) : (
                <p className="text-soft text-sm">データなし</p>
              )}
            </div>
          )}

          {isVisible('best_location') && (
            <div className="soft-card p-5 bg-sky-50 border-sky-200">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">📍</span>
                <p className="text-sm text-sky-700">今月のベスト場所</p>
              </div>
              {data.bestLocation ? (
                <>
                  <p className="text-lg font-bold text-sky-800">{data.bestLocation.name}</p>
                  <p className="text-sm text-sky-700 mb-1">
                    出店 {data.bestLocation.dayCount}日 / 平均売上
                  </p>
                  <p className="text-2xl font-bold text-sky-900">
                    {fmtYen(data.bestLocation.avgSales)}
                  </p>
                </>
              ) : (
                <p className="text-soft text-sm">データなし</p>
              )}
            </div>
          )}
        </div>
      )}

      {isVisible('top_products') && (
        <div className="soft-panel p-6 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">🥤</span>
            <h2 className="section-title text-lg font-semibold">今月の売上TOP3商品</h2>
          </div>

          {data.top3.length === 0 ? (
            <p className="section-subtitle text-sm">データがありません。</p>
          ) : (
            <ol className="space-y-3">
              {data.top3.map(([name, amount], i) => (
                <li key={name} className="flex items-center gap-4">
                  <span
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-sm
                    ${i === 0 ? 'bg-yellow-400' : i === 1 ? 'bg-gray-400' : 'bg-amber-600'}`}
                  >
                    {i + 1}
                  </span>
                  <span className="flex-1 text-main">{name}</span>
                  <span className="font-semibold text-gray-700">{fmtYen(amount)}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {isVisible('shortcuts') && (
        <>
          <div className="mb-3">
            <div className="badge-green badge-soft inline-block mb-3">ショートカット</div>
            <h2 className="section-title text-lg font-semibold">よく使うメニュー</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { href: '/upload', label: 'CSVアップロード', color: 'bg-blue-50 border-blue-200 text-blue-700', icon: '📂' },
              { href: '/locations', label: '出店場所登録', color: 'bg-green-50 border-green-200 text-green-700', icon: '📍' },
              { href: '/stall-logs', label: '出店ログ管理', color: 'bg-emerald-50 border-emerald-200 text-emerald-700', icon: '📝' },
              { href: '/analytics/locations', label: '場所分析', color: 'bg-purple-50 border-purple-200 text-purple-700', icon: '📊' },
              { href: '/analytics/products', label: '商品分析', color: 'bg-orange-50 border-orange-200 text-orange-700', icon: '🥤' },
            ].map(({ href, label, color, icon }) => (
              <a
                key={href}
                href={href}
                className={`soft-card border rounded-2xl p-4 text-center text-sm font-medium hover:opacity-95 transition ${color}`}
              >
                <div className="text-lg mb-1">{icon}</div>
                <div>{label}</div>
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
