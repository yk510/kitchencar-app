import { NextRequest, NextResponse } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { geocodeAddress } from '@/lib/geocode'
import { fetchWeather } from '@/lib/weather'

type PreviewInput = {
  id: string
  plan_date: string
  municipality: string | null
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRouteSession(req)
    if (auth.response) return auth.response

    const { days } = await req.json()

    if (!Array.isArray(days)) {
      return NextResponse.json({ error: 'days が不正です' }, { status: 400 })
    }

    const previews = await Promise.all(
      (days as PreviewInput[]).map(async (day) => {
        if (!day.id || !day.plan_date || !day.municipality) {
          return {
            id: day.id,
            weather_type: null,
            avg_temperature: null,
          }
        }

        const geo = await geocodeAddress(day.municipality)
        if (!geo) {
          return {
            id: day.id,
            weather_type: null,
            avg_temperature: null,
          }
        }

        const weather = await fetchWeather(geo.latitude, geo.longitude, day.plan_date)
        if (!weather) {
          return {
            id: day.id,
            weather_type: null,
            avg_temperature: null,
          }
        }

        const avgTemperature =
          weather.temperature_max != null && weather.temperature_min != null
            ? Number(((weather.temperature_max + weather.temperature_min) / 2).toFixed(1))
            : null

        return {
          id: day.id,
          weather_type: weather.weather_type,
          avg_temperature: avgTemperature,
        }
      })
    )

    return NextResponse.json({ data: previews })
  } catch (error) {
    console.error('[plans/weather-preview POST]', error)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
