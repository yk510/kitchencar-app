import { geocodeAddress } from '@/lib/geocode'
import { fetchWeather } from '@/lib/weather'

export interface PlanForecastInput {
  user_id: string
  plan_day_id: string
  plan_date: string
  operation_type: string
  location_id: string | null
  location_name: string | null
  municipality: string | null
  event_name: string | null
}

function average(values: number[]) {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function getWeekday(date: string) {
  return new Date(`${date}T00:00:00`).getDay()
}

function weatherBonus(a: string | null, b: string | null) {
  if (!a || !b) return 0
  return a === b ? 1 : 0
}

export async function createForecastForPlanDay(supabase: any, input: PlanForecastInput) {
  if (input.operation_type === 'closed') {
    await (supabase as any).from('sales_forecasts').upsert(
      [{
        user_id: input.user_id,
        plan_day_id: input.plan_day_id,
        forecast_date: input.plan_date,
        predicted_sales: 0,
        predicted_txn_count: 0,
        predicted_avg_ticket: 0,
        predicted_gross_profit: 0,
        confidence_score: 1,
        forecast_basis: '休業日のため予測値は0件',
      }],
      { onConflict: 'user_id,plan_day_id,forecast_date' }
    )

    return
  }

  let locationMeta: {
    id: string | null
    latitude: number | null
    longitude: number | null
    weather_type: string | null
    temperature_max: number | null
    temperature_min: number | null
  } = {
    id: input.location_id,
    latitude: null,
    longitude: null,
    weather_type: null,
    temperature_max: null,
    temperature_min: null,
  }

  if (input.location_id) {
    const { data: location } = await (supabase as any)
      .from('locations')
      .select('id, latitude, longitude')
      .eq('id', input.location_id)
      .single()

    if (location) {
      locationMeta = {
        ...locationMeta,
        id: location.id,
        latitude: location.latitude,
        longitude: location.longitude,
      }
    }
  }

  if ((locationMeta.latitude == null || locationMeta.longitude == null) && input.municipality) {
    const geo = await geocodeAddress(input.municipality)
    if (geo) {
      locationMeta.latitude = geo.latitude
      locationMeta.longitude = geo.longitude
    }
  }

  if (locationMeta.latitude != null && locationMeta.longitude != null) {
    const weather = await fetchWeather(
      locationMeta.latitude,
      locationMeta.longitude,
      input.plan_date
    )

    if (weather) {
      locationMeta = {
        ...locationMeta,
        weather_type: weather.weather_type,
        temperature_max: weather.temperature_max,
        temperature_min: weather.temperature_min,
      }

      await (supabase as any).from('weather_forecasts').upsert(
        [{
          user_id: input.user_id,
          plan_day_id: input.plan_day_id,
          forecast_date: input.plan_date,
          location_id: locationMeta.id,
          latitude: locationMeta.latitude,
          longitude: locationMeta.longitude,
          weather_type: weather.weather_type,
          weather_code: weather.weather_code,
          temperature_max: weather.temperature_max,
          temperature_min: weather.temperature_min,
        }],
        { onConflict: 'user_id,plan_day_id,forecast_date' }
      )
    }
  }

  const [{ data: txns }, { data: weatherLogs }, { data: productSales }, { data: costs }] =
    await Promise.all([
      (supabase as any)
        .from('transactions')
        .select('txn_no, txn_date, total_amount, location_id, event_id, day_of_week')
        .eq('is_return', false),
      (supabase as any)
        .from('weather_logs')
        .select('log_date, location_id, weather_type'),
      (supabase as any)
        .from('product_sales')
        .select('txn_no, txn_date, product_name, quantity'),
      (supabase as any)
        .from('product_master')
        .select('product_name, cost_amount'),
    ])

  const costMap = new Map<string, number>()
  for (const item of (costs ?? []) as any[]) {
    if (item.cost_amount != null) {
      costMap.set(item.product_name, item.cost_amount)
    }
  }

  const grossProfitByTxnNo = new Map<string, number>()
  for (const row of (productSales ?? []) as any[]) {
    const unitCost = costMap.get(row.product_name) ?? 0
    grossProfitByTxnNo.set(
      row.txn_no,
      (grossProfitByTxnNo.get(row.txn_no) ?? 0) + unitCost * (row.quantity ?? 0)
    )
  }

  const weatherByDateLocation = new Map<string, string>()
  for (const row of (weatherLogs ?? []) as any[]) {
    weatherByDateLocation.set(`${row.log_date}__${row.location_id ?? 'none'}`, row.weather_type)
  }

  const targetWeekday = getWeekday(input.plan_date)
  const targetHasEvent = Boolean(input.event_name?.trim())

  const samples = ((txns ?? []) as any[])
    .filter((txn) => txn.txn_date < input.plan_date)
    .map((txn) => {
      let score = 1

      if (input.location_id && txn.location_id === input.location_id) score += 2
      if (txn.day_of_week === ((targetWeekday + 6) % 7)) score += 1
      if (Boolean(txn.event_id) === targetHasEvent) score += 0.5

      const historicalWeather = weatherByDateLocation.get(`${txn.txn_date}__${txn.location_id ?? 'none'}`) ?? null
      score += weatherBonus(locationMeta.weather_type, historicalWeather)

      const estimatedCost = grossProfitByTxnNo.get(txn.txn_no) ?? 0

      return {
        sales: txn.total_amount ?? 0,
        txnCount: 1,
        avgTicket: txn.total_amount ?? 0,
        grossProfit: (txn.total_amount ?? 0) - estimatedCost,
        score,
      }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)

  const fallbackSales = average(((txns ?? []) as any[]).map((txn) => txn.total_amount ?? 0))

  const predictedSales = Math.round(
    samples.length > 0 ? average(samples.map((sample) => sample.sales)) : fallbackSales
  )
  const predictedTxnCount = Math.max(
    1,
    Math.round(samples.length > 0 ? average(samples.map((sample) => sample.txnCount)) : 1)
  )
  const predictedAvgTicket = Math.round(
    samples.length > 0 ? average(samples.map((sample) => sample.avgTicket)) : predictedSales
  )
  const predictedGrossProfit = Math.round(
    samples.length > 0
      ? average(samples.map((sample) => sample.grossProfit))
      : predictedSales * 0.6
  )
  const confidenceScore =
    samples.length === 0 ? 0.2 : Math.min(0.95, 0.35 + samples.length * 0.05)

  await (supabase as any).from('sales_forecasts').upsert(
    [{
      user_id: input.user_id,
      plan_day_id: input.plan_day_id,
      forecast_date: input.plan_date,
      predicted_sales: predictedSales,
      predicted_txn_count: predictedTxnCount,
      predicted_avg_ticket: predictedAvgTicket,
      predicted_gross_profit: predictedGrossProfit,
      confidence_score: confidenceScore,
      forecast_basis:
        samples.length > 0
          ? `過去実績 ${samples.length} 件をもとに予測`
          : '過去実績が少ないため全体平均をもとに予測',
    }],
    { onConflict: 'user_id,plan_day_id,forecast_date' }
  )
}
