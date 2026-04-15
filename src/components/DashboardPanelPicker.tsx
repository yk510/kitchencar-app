'use client'

import { DASHBOARD_PANEL_OPTIONS, type DashboardPanelId } from '@/lib/dashboardPanels'

export default function DashboardPanelPicker({
  visiblePanels,
  onToggle,
  onReset,
}: {
  visiblePanels: DashboardPanelId[]
  onToggle: (id: DashboardPanelId) => void
  onReset: () => void
}) {
  return (
    <div className="soft-panel p-5 mb-6">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div>
          <div className="badge-blue badge-soft inline-block mb-2">表示設定</div>
          <h2 className="section-title text-lg font-semibold">ダッシュボードの表示項目</h2>
          <p className="section-subtitle text-sm">
            見たい項目だけを表示できます
          </p>
        </div>

        <button
          type="button"
          onClick={onReset}
          className="soft-button bg-white border border-soft px-4 py-2 text-sm font-medium text-main shadow-sm"
        >
          初期設定に戻す
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {DASHBOARD_PANEL_OPTIONS.map((panel) => {
          const checked = visiblePanels.includes(panel.id)

          return (
            <label
              key={panel.id}
              className="soft-card p-4 flex items-center gap-3 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(panel.id)}
                className="h-4 w-4"
              />
              <span className="text-sm text-main">{panel.label}</span>
            </label>
          )
        })}
      </div>
    </div>
  )
}