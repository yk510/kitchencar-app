import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { geocodeAddress } from '@/lib/geocode'
import { fetchWeather } from '@/lib/weather'

// GET: 場所一覧
export async function GET() {
  const { data, error } = await (supabase as any)
    .from('locations')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// POST: 新規場所登録
export async function POST(req: NextRequest) {
  try {
    const { name, address, event_name, log_date } = await req.json()

    if (!name || !address) {
      return NextResponse.json({ error: '場所名と住所は必須です' }, { status: 400 })
    }

    const geo = await geocodeAddress(address)
    if (!geo) {
      return NextResponse.json(
        { error: '住所から座標を取得できませんでした。' },
        { status: 422 }
      )
    }

    const { data: location, error: locErr } = await (supabase as any)
      .from('locations')
      .upsert(
        [{ name, address, latitude: geo.latitude, longitude: geo.longitude }],
        { onConflict: 'name' }
      )
      .select()
      .single()

    if (locErr) return NextResponse.json({ error: locErr.message }, { status: 500 })

    let eventId: string | null = null
    if (event_name?.trim()) {
      const { data: evt } = await (supabase as any)
        .from('events')
        .upsert(
          [{ event_name: event_name.trim(), location_id: location.id }],
          { onConflict: 'event_name' }
        )
        .select('id')
        .single()
      eventId = evt?.id ?? null
    }

    const targetDate = log_date ?? new Date().toISOString().slice(0, 10)
    const weather = await fetchWeather(geo.latitude, geo.longitude, targetDate)

    if (weather) {
      await (supabase as any)
        .from('weather_logs')
        .upsert(
          [{
            log_date:        targetDate,
            location_id:     location.id,
            weather_type:    weather.weather_type,
            weather_code:    weather.weather_code,
            temperature_max: weather.temperature_max,
            temperature_min: weather.temperature_min,
          }],
          { onConflict: 'log_date,location_id' }
        )
    }

    return NextResponse.json({
      location,
      event_id: eventId,
      weather,
      geocoded: geo.displayName,
    })
  } catch (e) {
    console.error('[locations POST]', e)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}