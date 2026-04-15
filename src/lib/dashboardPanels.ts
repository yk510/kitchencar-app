export const DASHBOARD_PANEL_OPTIONS = [
  { id: 'today_tasks', label: '今日やること' },
  { id: 'missing_stall_logs', label: '出店ログ未登録' },
  { id: 'missing_costs', label: '原価未登録' },
  { id: 'today_sales', label: '本日の売上' },
  { id: 'month_sales', label: '今月の売上' },
  { id: 'today_txn_count', label: '本日の取引数' },
  { id: 'month_txn_count', label: '今月の取引数' },
  { id: 'avg_ticket', label: '平均取引単価' },
  { id: 'month_gross_profit', label: '今月の推定粗利' },
  { id: 'month_gross_margin', label: '今月の粗利率' },
  { id: 'best_day', label: '今月のベスト日' },
  { id: 'best_location', label: '今月のベスト場所' },
  { id: 'top_products', label: '今月の売上TOP3商品' },
  { id: 'shortcuts', label: 'ショートカット' },
] as const

export type DashboardPanelId = (typeof DASHBOARD_PANEL_OPTIONS)[number]['id']

export const DEFAULT_VISIBLE_PANELS: DashboardPanelId[] = [
  'today_tasks',
  'today_sales',
  'month_sales',
  'today_txn_count',
  'month_txn_count',
  'avg_ticket',
  'month_gross_profit',
  'month_gross_margin',
  'best_day',
  'best_location',
  'top_products',
  'shortcuts',
]

export const DASHBOARD_PANEL_STORAGE_KEY = 'kitchencar_dashboard_visible_panels'