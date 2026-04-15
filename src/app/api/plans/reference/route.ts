import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  try {
    const [{ data: locations, error: locationError }, { data: events, error: eventError }] =
      await Promise.all([
        (supabase as any)
          .from('locations')
          .select('id, name, address')
          .order('name', { ascending: true }),
        (supabase as any)
          .from('events')
          .select('event_name')
          .order('event_name', { ascending: true }),
      ])

    if (locationError) {
      return NextResponse.json({ error: locationError.message }, { status: 500 })
    }

    if (eventError) {
      return NextResponse.json({ error: eventError.message }, { status: 500 })
    }

    const eventNames = Array.from(
      new Set(
        ((events ?? []) as Array<{ event_name: string | null }>)
          .map((event) => event.event_name?.trim())
          .filter((eventName): eventName is string => Boolean(eventName))
      )
    )

    return NextResponse.json({
      locations: locations ?? [],
      eventNames,
    })
  } catch (error) {
    console.error('[plans/reference GET]', error)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
