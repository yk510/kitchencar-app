import type { ProductAnalyticsRow } from '@/lib/vendor-product-analytics'
import type { HourlyAnalyticsRow } from '@/lib/vendor-hourly-analytics'
import type { WeekdayAnalyticsRow } from '@/lib/vendor-weekday-analytics'
import type { VendorDailySalesRow } from '@/types/operations'

const DAY_LABELS = ['月', '火', '水', '木', '金', '土', '日']

export type HourlyHeatmapCell = {
  hour: number
  sales: number
}

export type HourlyHeatmapRow = {
  day: number
  label: string
  hours: HourlyHeatmapCell[]
}

export type DailyChartRow = {
  label: string
  売上: number
  会計数: number
}

export type DailySummary = {
  totalSales: number
  totalTxns: number
  totalItems: number
  avgTicket: number
  avgItemPrice: number
}

export type DailyColumnKey =
  | 'weekday'
  | 'holidayFlag'
  | 'locationName'
  | 'eventName'
  | 'municipality'
  | 'weatherType'
  | 'avgTemperature'
  | 'sales'
  | 'txnCount'
  | 'avgTicket'
  | 'itemCount'
  | 'avgItemPrice'
  | 'cashSales'
  | 'paypaySales'
  | 'otherSales'
  | 'grossProfit'
  | 'memo'

export function formatVendorProductAnalyticsPayload(rows: ProductAnalyticsRow[]) {
  return rows.map((row) => ({
    product_name: row.product_name,
    total_sales: row.total_sales,
    total_qty: row.total_qty,
    txn_count: row.txn_count,
    avg_sales_per_txn: row.avg_sales_per_txn,
    avg_price: row.avg_price,
    profit: row.profit,
    profit_rate: row.profit_rate,
    cost_amount: row.cost_amount,
    cost_rate_reg: row.cost_rate_reg,
    has_cost: row.has_cost,
    is_top3: row.is_top3,
    is_low_margin: row.is_low_margin,
  }))
}

export function formatVendorHourlyHeatmapData(heatmap: number[][]): HourlyHeatmapRow[] {
  return DAY_LABELS.map((dayLabel, dow) => ({
    day: dow,
    label: dayLabel,
    hours: heatmap[dow].map((sales, hour) => ({ hour, sales })),
  }))
}

export function formatVendorHourlyAnalyticsPayload(
  rows: HourlyAnalyticsRow[],
  heatmap: number[][]
) {
  return {
    hourly: rows.map((row) => ({
      hour: row.hour,
      label: row.label,
      total_sales: row.total_sales,
      total_cost: row.total_cost,
      gross_profit: row.gross_profit,
      txn_count: row.txn_count,
      avg_sales_per_txn: row.avg_sales_per_txn,
      performance: row.performance,
    })),
    heatmap: formatVendorHourlyHeatmapData(heatmap),
  }
}

export function formatVendorWeekdayAnalyticsPayload(rows: WeekdayAnalyticsRow[]) {
  return rows.map((row) => ({
    day_of_week: row.day,
    label: row.label,
    total_sales: row.total_sales,
    out_days: row.day_count,
    avg_sales: row.avg_sales,
    total_cost: row.total_cost,
    gross_profit: row.gross_profit,
    txn_count: row.txn_count,
    avg_sales_per_txn: row.avg_sales_per_txn,
    performance: row.performance,
  }))
}

export function buildVendorDailySummary(rows: VendorDailySalesRow[]): DailySummary {
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
}

export function buildVendorDailyChartRows(rows: VendorDailySalesRow[]): DailyChartRow[] {
  return rows.map((row) => ({
    label: row.date.slice(5),
    売上: row.sales,
    会計数: row.txnCount,
  }))
}

export function getVendorDailyColumnValue(
  row: VendorDailySalesRow,
  key: DailyColumnKey,
  memoValue: string
): string | number {
  switch (key) {
    case 'weekday':
      return row.weekday
    case 'holidayFlag':
      return row.holidayFlag || '-'
    case 'locationName':
      return row.locationName
    case 'eventName':
      return row.eventName
    case 'municipality':
      return row.municipality
    case 'weatherType':
      return row.weatherType
    case 'avgTemperature':
      return row.avgTemperature
    case 'sales':
      return row.sales
    case 'txnCount':
      return row.txnCount
    case 'avgTicket':
      return row.avgTicket
    case 'itemCount':
      return row.itemCount
    case 'avgItemPrice':
      return row.avgItemPrice
    case 'cashSales':
      return row.cashSales
    case 'paypaySales':
      return row.paypaySales
    case 'otherSales':
      return row.otherSales
    case 'grossProfit':
      return row.grossProfit
    case 'memo':
      return memoValue
    default:
      return ''
  }
}
