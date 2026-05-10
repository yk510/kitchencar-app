import { NextRequest } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import { normalizeAnalyticsDate } from '@/lib/analytics-date'
import type {
  AudioAnalyticsHourlyPayload,
  AudioAnalyticsHourlyRow,
} from '@/types/audio-analytics'

function normalizeId(value: string | null) {
  const text = String(value ?? '').trim()
  return text || null
}

function hourLabel(hour: number) {
  return `${String(hour).padStart(2, '0')}:00`
}

export async function GET(req: NextRequest) {
  const auth = await requireRouteSession(req, { includeProfile: false })
  if (auth.response) return auth.response
  const { supabase, user } = auth.session

  const start = normalizeAnalyticsDate(req.nextUrl.searchParams.get('start') ?? undefined)
  const end = normalizeAnalyticsDate(req.nextUrl.searchParams.get('end') ?? undefined)
  const sessionId = normalizeId(req.nextUrl.searchParams.get('session_id'))

  let query = (supabase as any)
    .from('audio_order_events')
    .select('quantity, event_at, session_id')
    .eq('user_id', user.id)
    .order('event_at', { ascending: true })

  if (start) query = query.gte('event_at', `${start}T00:00:00.000Z`)
  if (end) query = query.lte('event_at', `${end}T23:59:59.999Z`)
  if (sessionId) query = query.eq('session_id', sessionId)

  const { data, error } = await query
  if (error) {
    return apiError(error.message)
  }

  const hourly = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    label: hourLabel(hour),
    total_quantity: 0,
    order_event_count: 0,
  })) satisfies AudioAnalyticsHourlyRow[]

  for (const row of (data ?? []) as any[]) {
    const eventAt = String(row.event_at ?? '').trim()
    const quantity = Number(row.quantity ?? 0)
    if (!eventAt || quantity <= 0) continue

    const parsed = new Date(eventAt)
    if (Number.isNaN(parsed.getTime())) continue

    const hour = parsed.getHours()
    hourly[hour].total_quantity += quantity
    hourly[hour].order_event_count += 1
  }

  const payload: AudioAnalyticsHourlyPayload = {
    rows: hourly.filter((row) => row.order_event_count > 0),
  }

  return apiOk(payload)
}
