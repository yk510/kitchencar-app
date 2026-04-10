// ============================================================
// Open-Meteo API を使った天候取得
// APIキー不要・完全無料
// WMOコード → 4区分（晴れ/曇り/雨/雪）に変換
// ============================================================

import type { WeatherLog } from '@/types/database'

type WeatherType = WeatherLog['weather_type']

// WMOコード → 天候区分 の変換テーブル
// https://open-meteo.com/en/docs#weathervariables
function wmoToWeatherType(code: number): WeatherType {
  if (code === 0 || code === 1)              return '晴れ'
  if (code === 2 || code === 3)              return '曇り'
  if (code >= 51 && code <= 67)             return '雨'
  if (code >= 80 && code <= 82)             return '雨'
  if (code >= 85 && code <= 86)             return '雪'
  if (code >= 71 && code <= 77)             return '雪'
  if (code >= 95 && code <= 99)             return '雨'  // 雷雨
  if (code >= 45 && code <= 48)             return '曇り' // 霧
  return '曇り'
}

export interface WeatherResult {
  weather_type: WeatherType
  weather_code: number
  temperature_max: number
  temperature_min: number
}

// 緯度経度・日付から天候を取得（過去日付も対応）
export async function fetchWeather(
  latitude: number,
  longitude: number,
  date: string   // YYYY-MM-DD
): Promise<WeatherResult | null> {
  try {
    const url = new URL('https://api.open-meteo.com/v1/forecast')
    url.searchParams.set('latitude',        String(latitude))
    url.searchParams.set('longitude',       String(longitude))
    url.searchParams.set('daily',           'weathercode,temperature_2m_max,temperature_2m_min')
    url.searchParams.set('timezone',        'Asia/Tokyo')
    url.searchParams.set('start_date',      date)
    url.searchParams.set('end_date',        date)

    const res = await fetch(url.toString())
    if (!res.ok) return null

    const json = await res.json()
    const daily = json?.daily
    if (!daily || !daily.time || daily.time.length === 0) return null

    const code    = daily.weathercode?.[0]      as number
    const tempMax = daily.temperature_2m_max?.[0] as number
    const tempMin = daily.temperature_2m_min?.[0] as number

    if (code === undefined) return null

    return {
      weather_type:    wmoToWeatherType(code),
      weather_code:    code,
      temperature_max: tempMax,
      temperature_min: tempMin,
    }
  } catch {
    return null
  }
}
