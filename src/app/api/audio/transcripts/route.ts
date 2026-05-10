import { NextRequest } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import { persistAudioTranscriptsWithEvents } from '@/lib/audio/persist-audio-transcripts'
import type {
  AudioTranscriptCreatePayload,
  AudioTranscriptListPayload,
  AudioTranscriptMutationPayload,
} from '@/types/audio-analytics'

function normalizeId(value: unknown) {
  const text = String(value ?? '').trim()
  return text || null
}

function parseLimit(value: string | null) {
  const parsed = Number.parseInt(value ?? '50', 10)
  if (!Number.isFinite(parsed)) return 50
  return Math.min(Math.max(parsed, 1), 200)
}

export async function GET(req: NextRequest) {
  const auth = await requireRouteSession(req, { includeProfile: false })
  if (auth.response) return auth.response
  const { supabase, user } = auth.session

  const sessionId = normalizeId(req.nextUrl.searchParams.get('session_id'))
  const chunkId = normalizeId(req.nextUrl.searchParams.get('chunk_id'))
  const limit = parseLimit(req.nextUrl.searchParams.get('limit'))

  let query = (supabase as any)
    .from('audio_transcripts')
    .select('*')
    .eq('user_id', user.id)
    .order('spoken_at', { ascending: false })
    .limit(limit)

  if (sessionId) {
    query = query.eq('session_id', sessionId)
  }

  if (chunkId) {
    query = query.eq('chunk_id', chunkId)
  }

  const { data: transcripts, error: transcriptsError } = await query
  if (transcriptsError) {
    return apiError(transcriptsError.message)
  }

  const transcriptIds = (transcripts ?? []).map((row: { id: string }) => row.id)
  let eventsByTranscriptId = new Map<string, any[]>()

  if (transcriptIds.length > 0) {
    const { data: events, error: eventsError } = await (supabase as any)
      .from('audio_order_events')
      .select('*')
      .in('transcript_id', transcriptIds)
      .order('event_at', { ascending: true })

    if (eventsError) {
      return apiError(eventsError.message)
    }

    eventsByTranscriptId = new Map<string, any[]>()
    for (const event of events ?? []) {
      const bucket = eventsByTranscriptId.get(event.transcript_id) ?? []
      bucket.push(event)
      eventsByTranscriptId.set(event.transcript_id, bucket)
    }
  }

  const payload: AudioTranscriptListPayload = {
    transcripts: (transcripts ?? []).map((transcript: any) => ({
      ...transcript,
      extracted_events: eventsByTranscriptId.get(transcript.id) ?? [],
    })),
  }

  return apiOk(payload)
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRouteSession(req, { includeProfile: false })
    if (auth.response) return auth.response
    const { supabase, user } = auth.session

    const body = (await req.json()) as AudioTranscriptCreatePayload
    const sessionId = normalizeId(body.session_id)
    const chunkId = normalizeId(body.chunk_id)
    const transcriptsInput = Array.isArray(body.transcripts) ? body.transcripts : []

    if (!sessionId) {
      return apiError('session_id は必須です', 400)
    }

    if (!chunkId) {
      return apiError('chunk_id は必須です', 400)
    }

    if (transcriptsInput.length === 0) {
      return apiError('transcripts は1件以上必要です', 400)
    }

    const { data: chunk, error: chunkError } = await (supabase as any)
      .from('audio_capture_chunks')
      .select('id, session_id, user_id')
      .eq('id', chunkId)
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (chunkError) {
      return apiError(chunkError.message)
    }

    if (!chunk) {
      return apiError('対象の chunk が見つかりません', 404)
    }

    const result = await persistAudioTranscriptsWithEvents(
      supabase,
      user.id,
      sessionId,
      chunkId,
      transcriptsInput
    )

    const payload: AudioTranscriptMutationPayload = {
      transcripts: result.transcripts,
    }

    return apiOk(payload)
  } catch (error) {
    if (error instanceof Error) {
      return apiError(error.message, 400)
    }
    console.error('[audio/transcripts POST]', error)
    return apiError('サーバーエラー')
  }
}
