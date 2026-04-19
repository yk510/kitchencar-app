import { NextRequest } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import type {
  CrossAnalyticsDimensionKey as DimensionKey,
  CrossAnalyticsMetricKey as MetricKey,
  CrossAnalyticsPayload,
} from '@/types/api-payloads'

const WEEKDAY_LABELS = ['月', '火', '水', '木', '金', '土', '日'] as const

function normalizeDimensions(value: unknown): DimensionKey[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is DimensionKey =>
    ['location', 'weekday', 'weather', 'hour', 'product'].includes(String(item))
  )
}

function normalizeMetrics(value: unknown): MetricKey[] {
  if (!Array.isArray(value)) return ['sales', 'txn_count', 'avg_ticket']
  const metrics = value.filter((item): item is MetricKey =>
    ['sales', 'txn_count', 'avg_ticket', 'gross_profit', 'gross_profit_rate'].includes(
      String(item)
    )
  )
  return metrics.length > 0 ? metrics : ['sales', 'txn_count', 'avg_ticket']
}

function formatHourLabel(hour: number | null | undefined) {
  if (hour == null) return '不明'
  return `${String(hour).padStart(2, '0')}:00`
}

function getWeekdayLabel(dayOfWeek: number | null | undefined) {
  if (dayOfWeek == null) return '不明'
  return WEEKDAY_LABELS[dayOfWeek] ?? '不明'
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRouteSession(req)
    if (auth.response) return auth.response
    const { supabase } = auth.session

    const body = await req.json()
    const dimensions = normalizeDimensions(body.dimensions).slice(0, 2)
    const metrics = normalizeMetrics(body.metrics)
    const start = typeof body.start === 'string' ? body.start : ''
    const end = typeof body.end === 'string' ? body.end : ''

    if (dimensions.length === 0) {
      return apiError('分析軸を1つ以上選択してください', 400)
    }

    const [{ data: txns, error: txnError }, { data: sales, error: salesError }, { data: costs, error: costError }, { data: weatherLogs, error: weatherError }, { data: locations, error: locationError }] =
      await Promise.all([
        (supabase as any)
          .from('transactions')
          .select('txn_no, txn_date, total_amount, location_id, day_of_week, hour_of_day')
          .eq('is_return', false)
          .gte('txn_date', start || '1900-01-01')
          .lte('txn_date', end || '2999-12-31'),
        (supabase as any)
          .from('product_sales')
          .select('txn_no, txn_date, product_name, subtotal, quantity, location_id')
          .gte('txn_date', start || '1900-01-01')
          .lte('txn_date', end || '2999-12-31'),
        (supabase as any).from('product_master').select('product_name, cost_amount'),
        (supabase as any)
          .from('weather_logs')
          .select('log_date, location_id, weather_type')
          .gte('log_date', start || '1900-01-01')
          .lte('log_date', end || '2999-12-31'),
        (supabase as any).from('locations').select('id, name'),
      ])

    if (txnError) return apiError(txnError.message)
    if (salesError) return apiError(salesError.message)
    if (costError) return apiError(costError.message)
    if (weatherError) return apiError(weatherError.message)
    if (locationError) return apiError(locationError.message)

    const locationMap = new Map<string, string>()
    for (const location of (locations ?? []) as any[]) {
      locationMap.set(location.id, location.name)
    }

    const weatherMap = new Map<string, string>()
    for (const row of (weatherLogs ?? []) as any[]) {
      weatherMap.set(`${row.log_date}__${row.location_id ?? 'none'}`, row.weather_type ?? '不明')
    }

    const costMap = new Map<string, number>()
    for (const row of (costs ?? []) as any[]) {
      if (row.cost_amount != null) {
        costMap.set(row.product_name, row.cost_amount)
      }
    }

    const txnMetaMap = new Map<string, any>()
    for (const txn of (txns ?? []) as any[]) {
      txnMetaMap.set(txn.txn_no, {
        txn_no: txn.txn_no,
        txn_date: txn.txn_date,
        total_amount: txn.total_amount ?? 0,
        location_id: txn.location_id ?? null,
        location_name: txn.location_id ? locationMap.get(txn.location_id) ?? '未設定' : '未設定',
        weekday: getWeekdayLabel(txn.day_of_week),
        hour: formatHourLabel(txn.hour_of_day),
        weather:
          weatherMap.get(`${txn.txn_date}__${txn.location_id ?? 'none'}`) ??
          weatherMap.get(`${txn.txn_date}__none`) ??
          '不明',
      })
    }

    const txnCostMap = new Map<string, number>()
    for (const row of (sales ?? []) as any[]) {
      txnCostMap.set(
        row.txn_no,
        (txnCostMap.get(row.txn_no) ?? 0) + (costMap.get(row.product_name) ?? 0) * (row.quantity ?? 0)
      )
    }

    const useProductGrain = dimensions.includes('product')
    const bucketMap = new Map<
      string,
      {
        dimension_1: string
        dimension_2: string | null
        sales: number
        gross_profit: number
        txn_nos: Set<string>
        txn_total_for_avg: number
      }
    >()

    const getDimensionValue = (dimension: DimensionKey, source: any, txnMeta: any) => {
      switch (dimension) {
        case 'location':
          return txnMeta.location_name
        case 'weekday':
          return txnMeta.weekday
        case 'weather':
          return txnMeta.weather
        case 'hour':
          return txnMeta.hour
        case 'product':
          return source.product_name ?? '不明'
        default:
          return '不明'
      }
    }

    if (useProductGrain) {
      for (const row of (sales ?? []) as any[]) {
        const txnMeta = txnMetaMap.get(row.txn_no)
        if (!txnMeta) continue

        const key1 = getDimensionValue(dimensions[0], row, txnMeta)
        const key2 = dimensions[1] ? getDimensionValue(dimensions[1], row, txnMeta) : null
        const bucketKey = `${key1}__${key2 ?? ''}`
        const bucket = bucketMap.get(bucketKey) ?? {
          dimension_1: key1,
          dimension_2: key2,
          sales: 0,
          gross_profit: 0,
          txn_nos: new Set<string>(),
          txn_total_for_avg: 0,
        }

        bucket.sales += row.subtotal ?? 0
        bucket.gross_profit +=
          (row.subtotal ?? 0) - (costMap.get(row.product_name) ?? 0) * (row.quantity ?? 0)

        if (!bucket.txn_nos.has(row.txn_no)) {
          bucket.txn_nos.add(row.txn_no)
          bucket.txn_total_for_avg += txnMeta.total_amount ?? 0
        }

        bucketMap.set(bucketKey, bucket)
      }
    } else {
      for (const txn of (txns ?? []) as any[]) {
        const txnMeta = txnMetaMap.get(txn.txn_no)
        if (!txnMeta) continue

        const key1 = getDimensionValue(dimensions[0], txn, txnMeta)
        const key2 = dimensions[1] ? getDimensionValue(dimensions[1], txn, txnMeta) : null
        const bucketKey = `${key1}__${key2 ?? ''}`
        const bucket = bucketMap.get(bucketKey) ?? {
          dimension_1: key1,
          dimension_2: key2,
          sales: 0,
          gross_profit: 0,
          txn_nos: new Set<string>(),
          txn_total_for_avg: 0,
        }

        bucket.sales += txn.total_amount ?? 0
        bucket.gross_profit += (txn.total_amount ?? 0) - (txnCostMap.get(txn.txn_no) ?? 0)

        if (!bucket.txn_nos.has(txn.txn_no)) {
          bucket.txn_nos.add(txn.txn_no)
          bucket.txn_total_for_avg += txn.total_amount ?? 0
        }

        bucketMap.set(bucketKey, bucket)
      }
    }

    const rows = Array.from(bucketMap.values())
      .map((bucket) => {
        const txnCount = bucket.txn_nos.size
        const avgTicket = txnCount > 0 ? Math.round(bucket.txn_total_for_avg / txnCount) : 0
        const grossProfitRate =
          bucket.sales > 0 ? Number(((bucket.gross_profit / bucket.sales) * 100).toFixed(1)) : 0

        return {
          dimension_1: bucket.dimension_1,
          dimension_2: bucket.dimension_2,
          sales: bucket.sales,
          txn_count: txnCount,
          avg_ticket: avgTicket,
          gross_profit: bucket.gross_profit,
          gross_profit_rate: grossProfitRate,
        }
      })
      .sort((a, b) => b.sales - a.sales)

    const payload: CrossAnalyticsPayload = {
      dimensions,
      metrics,
      rows,
    }

    return apiOk(payload)
  } catch (error) {
    console.error('[analytics/cross POST]', error)
    return apiError('サーバーエラー')
  }
}
