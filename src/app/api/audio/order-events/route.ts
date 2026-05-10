import { NextRequest } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { normalizeAnalyticsDate } from '@/lib/analytics-date'
import { apiError, apiOk } from '@/lib/api-response'
import type { AudioOrderEventListPayload, AudioOrderEventListRow } from '@/types/audio-analytics'

function normalizeId(value: string | null) {
  const text = String(value ?? '').trim()
  return text || null
}

function normalizeLimit(value: string | null) {
  const parsed = Number(value ?? 300)
  if (!Number.isFinite(parsed) || parsed <= 0) return 300
  return Math.min(parsed, 1000)
}

export async function GET(req: NextRequest) {
  const auth = await requireRouteSession(req, { includeProfile: false })
  if (auth.response) return auth.response
  const { supabase, user } = auth.session

  const start = normalizeAnalyticsDate(req.nextUrl.searchParams.get('start') ?? undefined)
  const end = normalizeAnalyticsDate(req.nextUrl.searchParams.get('end') ?? undefined)
  const sessionId = normalizeId(req.nextUrl.searchParams.get('session_id'))
  const limit = normalizeLimit(req.nextUrl.searchParams.get('limit'))

  let query = (supabase as any)
    .from('audio_order_events')
    .select(`
      id,
      transcript_id,
      session_id,
      user_id,
      product_id,
      product_name_raw,
      normalized_product_name,
      quantity,
      confidence,
      event_at,
      created_at,
      audio_transcripts (
        transcript_text,
        speaker_type
      )
    `)
    .eq('user_id', user.id)
    .order('event_at', { ascending: true })
    .limit(limit)

  if (start) query = query.gte('event_at', `${start}T00:00:00.000Z`)
  if (end) query = query.lte('event_at', `${end}T23:59:59.999Z`)
  if (sessionId) query = query.eq('session_id', sessionId)

  const { data, error } = await query
  if (error) {
    return apiError(error.message)
  }

  const payload: AudioOrderEventListPayload = {
    rows: ((data ?? []) as any[]).map(
      (row): AudioOrderEventListRow => ({
        id: row.id,
        transcript_id: row.transcript_id,
        session_id: row.session_id,
        user_id: row.user_id,
        product_id: row.product_id ?? null,
        product_name_raw: row.product_name_raw,
        normalized_product_name: row.normalized_product_name ?? null,
        quantity: Number(row.quantity ?? 0),
        confidence: row.confidence == null ? null : Number(row.confidence),
        event_at: row.event_at,
        created_at: row.created_at,
        transcript_text: row.audio_transcripts?.transcript_text ?? null,
        speaker_type: row.audio_transcripts?.speaker_type ?? null,
      }),
    ),
  }

  return apiOk(payload)
}
