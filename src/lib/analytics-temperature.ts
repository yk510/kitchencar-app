export type TemperatureBucket = {
  key: string
  label: string
  sortOrder: number
}

const TEMPERATURE_BUCKETS: TemperatureBucket[] = [
  { key: 'below_5', label: '5℃未満', sortOrder: 0 },
  { key: '5_9', label: '5〜9℃', sortOrder: 1 },
  { key: '10_14', label: '10〜14℃', sortOrder: 2 },
  { key: '15_19', label: '15〜19℃', sortOrder: 3 },
  { key: '20_24', label: '20〜24℃', sortOrder: 4 },
  { key: '25_29', label: '25〜29℃', sortOrder: 5 },
  { key: '30_plus', label: '30℃以上', sortOrder: 6 },
]

export const UNKNOWN_TEMPERATURE_BUCKET: TemperatureBucket = {
  key: 'unknown',
  label: '不明',
  sortOrder: 99,
}

export function calculateAverageTemperature(
  temperatureMin: number | null | undefined,
  temperatureMax: number | null | undefined
) {
  if (temperatureMin == null || temperatureMax == null) return null
  return Number(((temperatureMin + temperatureMax) / 2).toFixed(1))
}

export function resolveTemperatureBucket(avgTemperature: number | null | undefined): TemperatureBucket {
  if (avgTemperature == null || Number.isNaN(avgTemperature)) return UNKNOWN_TEMPERATURE_BUCKET
  if (avgTemperature < 5) return TEMPERATURE_BUCKETS[0]
  if (avgTemperature < 10) return TEMPERATURE_BUCKETS[1]
  if (avgTemperature < 15) return TEMPERATURE_BUCKETS[2]
  if (avgTemperature < 20) return TEMPERATURE_BUCKETS[3]
  if (avgTemperature < 25) return TEMPERATURE_BUCKETS[4]
  if (avgTemperature < 30) return TEMPERATURE_BUCKETS[5]
  return TEMPERATURE_BUCKETS[6]
}

export function formatTemperatureLabel(avgTemperature: number | null | undefined) {
  if (avgTemperature == null || Number.isNaN(avgTemperature)) return '不明'
  return `${avgTemperature.toFixed(1)}℃`
}
