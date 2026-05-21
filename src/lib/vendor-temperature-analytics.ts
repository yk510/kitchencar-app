import {
  buildStallLogResolutionMap,
  matchesAnalyticsScope,
  resolveAnalyticsEventId,
  resolveAnalyticsLocationId,
  type AnalyticsScopeFilter,
} from '@/lib/analytics-resolution'
import {
  calculateAverageTemperature,
  formatTemperatureLabel,
  resolveTemperatureBucket,
} from '@/lib/analytics-temperature'
import { fetchMobileOrderAnalyticsData } from '@/lib/mobile-order-analytics'
import {
  calculateCostFromProductMaster,
  loadProductMasterCostContext,
  resolveCostForMobileOrderOptionChoice,
  resolveCostForMobileOrderProduct,
} from '@/lib/product-master-links'

export type TemperatureAnalyticsRow = {
  bucket_key: string
  label: string
  avg_temperature: number | null
  avg_temperature_label: string
  total_sales: number
  total_cost: number
  gross_profit: number
  avg_sales: number
  avg_sales_per_txn: number
  day_count: number
  txn_count: number
  performance: 'high' | 'mid' | 'low'
}

type BucketAccumulator = {
  bucket_key: string
  label: string
  sortOrder: number
  totalSales: number
  totalCost: number
  days: Set<string>
  txnSet: Set<string>
  temperatureSum: number
  temperatureCount: number
}

type WeatherLogLike = {
  log_date: string
  location_id: string | null
  temperature_min: number | null
  temperature_max: number | null
}

function getOrCreateBucket(
  map: Map<string, BucketAccumulator>,
  bucketKey: string,
  label: string,
  sortOrder: number
) {
  const current = map.get(bucketKey)
  if (current) return current

  const next: BucketAccumulator = {
    bucket_key: bucketKey,
    label,
    sortOrder,
    totalSales: 0,
    totalCost: 0,
    days: new Set<string>(),
    txnSet: new Set<string>(),
    temperatureSum: 0,
    temperatureCount: 0,
  }
  map.set(bucketKey, next)
  return next
}

export async function getVendorTemperatureAnalytics(
  supabase: any,
  userId: string,
  scope: AnalyticsScopeFilter,
  start?: string,
  end?: string
): Promise<TemperatureAnalyticsRow[]> {
  let txnQuery = (supabase as any)
    .from('transactions')
    .select('txn_no, txn_date, total_amount, event_id, location_id')
    .eq('is_return', false)
  if (start) txnQuery = txnQuery.gte('txn_date', start)
  if (end) txnQuery = txnQuery.lte('txn_date', end)
  const { data: txns, error: txErr } = await txnQuery
  if (txErr) throw new Error(txErr.message)

  let salesQuery = (supabase as any)
    .from('product_sales')
    .select('product_name, quantity, txn_date, event_id, location_id')
  if (start) salesQuery = salesQuery.gte('txn_date', start)
  if (end) salesQuery = salesQuery.lte('txn_date', end)
  const { data: sales, error: salesErr } = await salesQuery
  if (salesErr) throw new Error(salesErr.message)

  let stallLogsQuery = (supabase as any).from('stall_logs').select('log_date, event_id, location_id')
  if (start) stallLogsQuery = stallLogsQuery.gte('log_date', start)
  if (end) stallLogsQuery = stallLogsQuery.lte('log_date', end)
  const { data: stallLogs, error: stallLogsErr } = await stallLogsQuery
  if (stallLogsErr) throw new Error(stallLogsErr.message)

  let weatherQuery = (supabase as any)
    .from('weather_logs')
    .select('log_date, location_id, temperature_min, temperature_max')
  if (start) weatherQuery = weatherQuery.gte('log_date', start)
  if (end) weatherQuery = weatherQuery.lte('log_date', end)
  const { data: weatherLogs, error: weatherErr } = await weatherQuery
  if (weatherErr) throw new Error(weatherErr.message)

  const { data: costs, error: costsErr } = await (supabase as any)
    .from('product_master')
    .select('product_name, cost_amount')
  if (costsErr) throw new Error(costsErr.message)

  const costMap = new Map<string, number>()
  for (const c of (costs ?? []) as any[]) {
    if (c.cost_amount != null) costMap.set(c.product_name, c.cost_amount)
  }

  const stallLogByDate = buildStallLogResolutionMap((stallLogs ?? []) as any[])
  const weatherMap = new Map<string, number | null>()
  for (const row of (weatherLogs ?? []) as WeatherLogLike[]) {
    weatherMap.set(
      `${row.log_date}__${row.location_id ?? 'none'}`,
      calculateAverageTemperature(row.temperature_min, row.temperature_max)
    )
  }

  const bucketMap = new Map<string, BucketAccumulator>()

  const mobileOrderAnalytics = await fetchMobileOrderAnalyticsData(supabase, { scope, start, end, stallLogByDate })
  const costContext = await loadProductMasterCostContext(supabase, userId)

  for (const txn of (txns ?? []) as any[]) {
    const resolvedEventId = resolveAnalyticsEventId(txn.txn_date, txn.event_id, stallLogByDate)
    if (!matchesAnalyticsScope(scope, resolvedEventId)) continue

    const resolvedLocationId = resolveAnalyticsLocationId(txn.txn_date, txn.location_id, stallLogByDate)
    const avgTemperature =
      weatherMap.get(`${txn.txn_date}__${resolvedLocationId ?? 'none'}`) ??
      weatherMap.get(`${txn.txn_date}__none`) ??
      null
    const bucket = resolveTemperatureBucket(avgTemperature)
    const entry = getOrCreateBucket(bucketMap, bucket.key, bucket.label, bucket.sortOrder)

    entry.totalSales += txn.total_amount ?? 0
    if (txn.txn_date) entry.days.add(txn.txn_date)
    if (txn.txn_no) entry.txnSet.add(txn.txn_no)
    if (avgTemperature != null) {
      entry.temperatureSum += avgTemperature
      entry.temperatureCount += 1
    }
  }

  for (const row of (sales ?? []) as any[]) {
    const resolvedEventId = resolveAnalyticsEventId(row.txn_date, row.event_id, stallLogByDate)
    if (!matchesAnalyticsScope(scope, resolvedEventId)) continue
    if (!row.txn_date) continue

    const resolvedLocationId = resolveAnalyticsLocationId(row.txn_date, row.location_id, stallLogByDate)
    const avgTemperature =
      weatherMap.get(`${row.txn_date}__${resolvedLocationId ?? 'none'}`) ??
      weatherMap.get(`${row.txn_date}__none`) ??
      null
    const bucket = resolveTemperatureBucket(avgTemperature)
    const entry = getOrCreateBucket(bucketMap, bucket.key, bucket.label, bucket.sortOrder)
    const unitCost = costMap.get(row.product_name)
    if (unitCost != null) {
      entry.totalCost += unitCost * (row.quantity ?? 0)
    }
  }

  const mobileOrderMap = new Map(mobileOrderAnalytics.orders.map((order) => [order.id, order]))
  for (const order of mobileOrderAnalytics.orders) {
    const avgTemperature =
      weatherMap.get(`${order.businessDate}__${order.locationId ?? 'none'}`) ??
      weatherMap.get(`${order.businessDate}__none`) ??
      null
    const bucket = resolveTemperatureBucket(avgTemperature)
    const entry = getOrCreateBucket(bucketMap, bucket.key, bucket.label, bucket.sortOrder)

    entry.totalSales += order.totalAmount
    entry.days.add(order.businessDate)
    entry.txnSet.add(order.id)
    if (avgTemperature != null) {
      entry.temperatureSum += avgTemperature
      entry.temperatureCount += 1
    }
  }

  for (const item of mobileOrderAnalytics.items) {
    const order = mobileOrderMap.get(item.orderId)
    if (!order) continue
    const avgTemperature =
      weatherMap.get(`${order.businessDate}__${order.locationId ?? 'none'}`) ??
      weatherMap.get(`${order.businessDate}__none`) ??
      null
    const bucket = resolveTemperatureBucket(avgTemperature)
    const entry = getOrCreateBucket(bucketMap, bucket.key, bucket.label, bucket.sortOrder)

    const linkedProductMaster = resolveCostForMobileOrderProduct(item.productId, item.productName, costContext)
    if (linkedProductMaster) {
      entry.totalCost += calculateCostFromProductMaster(linkedProductMaster, item.quantity, item.lineTotalAmount)
    }
    for (const optionChoice of item.optionChoices) {
      const linkedOptionMaster = resolveCostForMobileOrderOptionChoice(null, optionChoice.optionChoiceName, costContext)
      entry.totalCost += calculateCostFromProductMaster(
        linkedOptionMaster,
        item.quantity,
        optionChoice.priceDelta * item.quantity
      )
    }
  }

  const rows = Array.from(bucketMap.values()).map((value) => {
    const dayCount = value.days.size
    const txnCount = value.txnSet.size
    const avgSales = dayCount > 0 ? Math.round(value.totalSales / dayCount) : 0
    const avgSalesPerTxn = txnCount > 0 ? Math.round(value.totalSales / txnCount) : 0
    const avgTemperature =
      value.temperatureCount > 0 ? Number((value.temperatureSum / value.temperatureCount).toFixed(1)) : null

    return {
      bucket_key: value.bucket_key,
      label: value.label,
      avg_temperature: avgTemperature,
      avg_temperature_label: formatTemperatureLabel(avgTemperature),
      total_sales: value.totalSales,
      total_cost: value.totalCost,
      gross_profit: value.totalSales - value.totalCost,
      avg_sales: avgSales,
      avg_sales_per_txn: avgSalesPerTxn,
      day_count: dayCount,
      txn_count: txnCount,
      sortOrder: value.sortOrder,
    }
  })

  const ranked = [...rows].sort((a, b) => b.avg_sales - a.avg_sales)
  const total = ranked.length
  const perfMap = new Map<string, 'high' | 'mid' | 'low'>()
  ranked.forEach((row, i) => {
    let performance: 'high' | 'mid' | 'low'
    if (i < Math.ceil(total * 0.3)) performance = 'high'
    else if (i >= total - Math.ceil(total * 0.3)) performance = 'low'
    else performance = 'mid'
    perfMap.set(row.bucket_key, performance)
  })

  return rows
    .map((row) => ({
      bucket_key: row.bucket_key,
      label: row.label,
      avg_temperature: row.avg_temperature,
      avg_temperature_label: row.avg_temperature_label,
      total_sales: row.total_sales,
      total_cost: row.total_cost,
      gross_profit: row.gross_profit,
      avg_sales: row.avg_sales,
      avg_sales_per_txn: row.avg_sales_per_txn,
      day_count: row.day_count,
      txn_count: row.txn_count,
      performance: perfMap.get(row.bucket_key) ?? 'mid',
    }))
    .sort((a, b) => {
      const bucketA = resolveTemperatureBucket(a.avg_temperature)
      const bucketB = resolveTemperatureBucket(b.avg_temperature)
      if (a.bucket_key === 'unknown') return 1
      if (b.bucket_key === 'unknown') return -1
      return bucketA.sortOrder - bucketB.sortOrder
    })
}
