import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { requireRouteSession } from '@/lib/auth'
import { fetchWeather } from '@/lib/weather'

async function getUnmatchedDates(supabase: any) {
  const [{ data: txnDates, error: txnError }, { data: logDates, error: logError }] =
    await Promise.all([
      (supabase as any)
        .from('transactions')
        .select('txn_date')
        .eq('is_return', false),
      (supabase as any).from('stall_logs').select('log_date'),
    ])

  if (txnError) throw new Error(txnError.message)
  if (logError) throw new Error(logError.message)

  const txnDateSet = new Set(((txnDates ?? []) as any[]).map((row: any) => row.txn_date))
  const logDateSet = new Set(((logDates ?? []) as any[]).map((row: any) => row.log_date))

  return Array.from(txnDateSet)
    .filter((date) => !logDateSet.has(date))
    .sort()
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRouteSession(req)
    if (auth.response) return auth.response
    const { supabase } = auth.session
    const unmatchedDates = await getUnmatchedDates(supabase)

    return NextResponse.json({
      unmatched_dates: unmatchedDates,
      count: unmatchedDates.length,
    })
  } catch (error) {
    console.error('[stall-logs GET]', error)
    return NextResponse.json({ error: '未登録日付の取得に失敗しました' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRouteSession(req)
    if (auth.response) return auth.response
    const { supabase, user } = auth.session

    const { log_date, location_id, event_name } = await req.json()

    if (!log_date || !location_id) {
      return NextResponse.json({ error: '出店日と出店場所は必須です' }, { status: 400 })
    }

    let eventId: string | null = null
    const trimmedEventName = typeof event_name === 'string' ? event_name.trim() : ''

    if (trimmedEventName) {
      const { data: event, error: eventError } = await (supabase as any)
        .from('events')
        .upsert(
          [
            {
              user_id: user.id,
              event_name: trimmedEventName,
              event_date: log_date,
              location_id,
            },
          ],
          { onConflict: 'user_id,event_name,event_date,location_id' }
        )
        .select('id')
        .single()

      if (eventError) {
        return NextResponse.json({ error: eventError.message }, { status: 500 })
      }

      eventId = event?.id ?? null
    }

    const { data: stallLog, error: stallLogError } = await (supabase as any)
      .from('stall_logs')
      .upsert(
        [
          {
            user_id: user.id,
            log_date,
            location_id,
            event_id: eventId,
          },
        ],
        { onConflict: 'user_id,log_date' }
      )
      .select()
      .single()

    if (stallLogError || !stallLog) {
      return NextResponse.json(
        { error: stallLogError?.message ?? '出店ログの保存に失敗しました' },
        { status: 500 }
      )
    }

    const { error: transactionError, count: updatedTransactions } = await (supabase as any)
      .from('transactions')
      .update({
        location_id,
        event_id: eventId,
      })
      .eq('txn_date', log_date)
      .select('*', { count: 'exact', head: true })

    if (transactionError) {
      return NextResponse.json({ error: transactionError.message }, { status: 500 })
    }

    const { error: salesError, count: updatedProductSales } = await (supabase as any)
      .from('product_sales')
      .update({
        location_id,
        event_id: eventId,
      })
      .eq('txn_date', log_date)
      .select('*', { count: 'exact', head: true })

    if (salesError) {
      return NextResponse.json({ error: salesError.message }, { status: 500 })
    }

    const { data: location, error: locationError } = await (supabase as any)
      .from('locations')
      .select('latitude, longitude')
      .eq('id', location_id)
      .single()

    if (locationError) {
      return NextResponse.json({ error: locationError.message }, { status: 500 })
    }

    if (location?.latitude != null && location?.longitude != null) {
      const weather = await fetchWeather(location.latitude, location.longitude, log_date)

      if (weather) {
        const { error: weatherError } = await (supabase as any)
          .from('weather_logs')
          .upsert(
            [
              {
                user_id: user.id,
                log_date,
                location_id,
                weather_type: weather.weather_type,
                weather_code: weather.weather_code,
                temperature_max: weather.temperature_max,
                temperature_min: weather.temperature_min,
              },
            ],
            { onConflict: 'user_id,log_date,location_id' }
          )

        if (weatherError) {
          return NextResponse.json({ error: weatherError.message }, { status: 500 })
        }
      }
    }

    revalidatePath('/')
    revalidatePath('/stall-logs')
    revalidatePath('/analytics/daily')
    revalidatePath('/analytics/locations')
    revalidatePath('/analytics/events')

    return NextResponse.json({
      stall_log: stallLog,
      updated_transactions: updatedTransactions ?? 0,
      updated_product_sales: updatedProductSales ?? 0,
      event_id: eventId,
    })
  } catch (error) {
    console.error('[stall-logs POST]', error)
    return NextResponse.json({ error: '出店ログの登録に失敗しました' }, { status: 500 })
  }
}
