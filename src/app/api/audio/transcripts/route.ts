import { NextRequest } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import { extractAudioOrderEvents } from '@/lib/audio/extract-order-events'
import { loadAudioProductAliasDictionary } from '@/lib/audio/product-alias'
import type {
  AudioOrderEventCreateItem,
  AudioTranscriptCreatePayload,
  AudioTranscriptListPayload,
  AudioTranscriptListRow,
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

    const transcriptRows = transcriptsInput.map((item) => {
      const spokenAt = String(item.spoken_at ?? '').trim()
      const transcriptText = String(item.transcript_text ?? '').trim()

      if (!spokenAt) {
        throw new Error('spoken_at は必須です')
      }

      if (!transcriptText) {
        throw new Error('transcript_text は必須です')
      }

      const parsedSpokenAt = new Date(spokenAt)
      if (Number.isNaN(parsedSpokenAt.getTime())) {
        throw new Error('spoken_at は ISO 形式の日付文字列で指定してください')
      }

      return {
        chunk_id: chunkId,
        session_id: sessionId,
        user_id: user.id,
        spoken_at: parsedSpokenAt.toISOString(),
        speaker_type: item.speaker_type ?? 'staff',
        transcript_text: transcriptText,
        confidence: item.confidence ?? null,
      }
    })

    const { data: createdTranscripts, error: transcriptInsertError } = await (supabase as any)
      .from('audio_transcripts')
      .insert(transcriptRows)
      .select('*')

    if (transcriptInsertError) {
      return apiError(transcriptInsertError.message)
    }

    const dictionary = await loadAudioProductAliasDictionary(supabase, user.id)
    const eventRows: AudioOrderEventCreateItem[] = []

    ;(createdTranscripts ?? []).forEach((transcript: any, index: number) => {
      const extracted = extractAudioOrderEvents(dictionary, transcript.transcript_text)
      for (const event of extracted) {
        eventRows.push({
          transcript_id: transcript.id,
          product_id: event.productId,
          product_name_raw: event.productNameRaw,
          normalized_product_name: event.normalizedProductName,
          quantity: event.quantity,
          confidence: transcript.confidence ?? null,
          event_at: transcript.spoken_at,
        })
      }
    })

    let createdEvents: any[] = []
    if (eventRows.length > 0) {
      const { data: insertedEvents, error: eventInsertError } = await (supabase as any)
        .from('audio_order_events')
        .insert(
          eventRows.map((event) => ({
            transcript_id: event.transcript_id,
            session_id: sessionId,
            user_id: user.id,
            product_id: event.product_id ?? null,
            product_name_raw: event.product_name_raw,
            normalized_product_name: event.normalized_product_name ?? null,
            quantity: event.quantity,
            confidence: event.confidence ?? null,
            event_at: event.event_at,
          }))
        )
        .select('*')

      if (eventInsertError) {
        return apiError(eventInsertError.message)
      }

      createdEvents = insertedEvents ?? []
    }

    const { error: chunkUpdateError } = await (supabase as any)
      .from('audio_capture_chunks')
      .update({ transcription_status: 'completed' })
      .eq('id', chunkId)
      .eq('user_id', user.id)

    if (chunkUpdateError) {
      return apiError(chunkUpdateError.message)
    }

    const eventsByTranscriptId = new Map<string, any[]>()
    for (const event of createdEvents) {
      const bucket = eventsByTranscriptId.get(event.transcript_id) ?? []
      bucket.push(event)
      eventsByTranscriptId.set(event.transcript_id, bucket)
    }

    const payload: AudioTranscriptMutationPayload = {
      transcripts: (createdTranscripts ?? []).map((transcript: any): AudioTranscriptListRow => ({
        ...transcript,
        extracted_events: eventsByTranscriptId.get(transcript.id) ?? [],
      })),
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
