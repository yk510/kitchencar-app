import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { geocodeAddress } from '@/lib/geocode'
import { fetchWeather } from '@/lib/weather'

// GET: 場所一覧
export async function GET() {
  const { data, error } = await supabase
    .from('locations')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// POST: 新規場所登録（ジオコーディング + 天候取得を自動実行）
export async function POST(req: NextRequest) {
  try {
    const { name, address, event_name, log_date } = await req.json()

    if (!name || !address) {
      return NextResponse.json({ error: '場所名と住所は必須です' }, { status: 400 })
    }

    // 1. 住所 → 緯度経度
    const geo = await geocodeAddress(address)
    if (!geo) {
      return NextResponse.json(
        { error: '住所から座標を取得できませんでした。住所をより具体的に入力してください。' },
        { status: 422 }
      )
    }

    // 2. 場所を登録（同じ住所が既存の場合は upsert）
    const { data: location, error: locErr } = await supabase
      .from('locations')
      .upsert(
        { name, address, latitude: geo.latitude, longitude: geo.longitude },
        { onConflict: 'name' }    // 同じ名前の場所は更新
      )
      .select()
      .single()

    if (locErr) return NextResponse.json({ error: locErr.message }, { status: 500 })

    // 3. イベント名がある場合は events に登録
    let eventId: string | null = null
    if (event_name?.trim()) {
      const { data: evt } = await supabase
        .from('events')
        .upsert(
          { event_name: event_name.trim(), location_id: location.id },
          { onConflict: 'event_name' }
        )
        .select('id')
        .single()
      eventId = evt?.id ?? null
    }

    // 4. 天候を取得・保存（出店日が指定されている場合）
    const targetDate = log_date ?? new Date().toISOString().slice(0, 10)
    const weather = await fetchWeather(geo.latitude, geo.longitude, targetDate)

    if (weather) {
      await supabase
        .from('weather_logs')
        .upsert(
          {
            log_date:        targetDate,
            location_id:     location.id,
            weather_type:    weather.weather_type,
            weather_code:    weather.weather_code,
            temperature_max: weather.temperature_max,
            temperature_min: weather.temperature_min,
          },
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
