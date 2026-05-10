import { NextRequest } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import { persistAudioTranscriptsWithEvents } from '@/lib/audio/persist-audio-transcripts'
import type {
  AudioCaptureSessionStatus,
  AudioImportCatalogProductInput,
  AudioTranscriptImportChunkInput,
  AudioTranscriptImportPayload,
  AudioTranscriptImportResultPayload,
} from '@/types/audio-analytics'

const VALID_AUDIO_SESSION_STATUSES = new Set<AudioCaptureSessionStatus>([
  'recording',
  'paused',
  'completed',
  'failed',
])

function normalizeText(value: unknown) {
  const text = String(value ?? '').trim()
  return text || null
}

function toIsoOrNull(value: unknown) {
  const text = String(value ?? '').trim()
  if (!text) return null
  const parsed = new Date(text)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error('日時は ISO 形式の日付文字列で指定してください')
  }
  return parsed.toISOString()
}

function deriveChunkWindow(chunk: AudioTranscriptImportChunkInput) {
  const spokenTimes = chunk.transcripts
    .map((item) => {
      const parsed = new Date(String(item.spoken_at ?? '').trim())
      return Number.isNaN(parsed.getTime()) ? null : parsed
    })
    .filter((value): value is Date => value instanceof Date)
    .sort((left, right) => left.getTime() - right.getTime())

  if (spokenTimes.length === 0) {
    throw new Error('chunk に transcripts が1件以上必要です')
  }

  const startedAt = toIsoOrNull(chunk.started_at) ?? spokenTimes[0].toISOString()
  const endedAt = toIsoOrNull(chunk.ended_at) ?? spokenTimes[spokenTimes.length - 1].toISOString()
  const durationSec =
    chunk.duration_sec && Number.isFinite(chunk.duration_sec)
      ? Math.max(1, Math.round(chunk.duration_sec))
      : Math.max(1, Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000))

  return { startedAt, endedAt, durationSec }
}

function normalizeImportChunks(payload: AudioTranscriptImportPayload): AudioTranscriptImportChunkInput[] {
  if (Array.isArray(payload.chunks) && payload.chunks.length > 0) {
    return payload.chunks
  }

  if (Array.isArray(payload.chunk_payload_templates) && payload.chunk_payload_templates.length > 0) {
    return payload.chunk_payload_templates.map((chunk) => ({
      chunk_label: normalizeText(chunk.chunk_label),
      transcripts: chunk.transcripts,
    }))
  }

  throw new Error('chunks もしくは chunk_payload_templates が必要です')
}

function deriveSessionWindow(chunks: AudioTranscriptImportChunkInput[]) {
  const windows = chunks.map((chunk) => deriveChunkWindow(chunk))
  const sortedStarts = windows.map((window) => new Date(window.startedAt)).sort((a, b) => a.getTime() - b.getTime())
  const sortedEnds = windows.map((window) => new Date(window.endedAt)).sort((a, b) => a.getTime() - b.getTime())

  return {
    startedAt: sortedStarts[0].toISOString(),
    endedAt: sortedEnds[sortedEnds.length - 1].toISOString(),
  }
}

function deriveImportCatalogProducts(payload: AudioTranscriptImportPayload): AudioImportCatalogProductInput[] {
  if (Array.isArray(payload.product_catalog?.products) && payload.product_catalog.products.length > 0) {
    return payload.product_catalog.products
      .map((product) => ({
        product_name: String(product.product_name ?? '').trim(),
        aliases: Array.isArray(product.aliases)
          ? product.aliases.map((alias) => String(alias ?? '').trim()).filter(Boolean)
          : [],
      }))
      .filter((product) => product.product_name)
  }

  if (Array.isArray(payload.assumptions?.products) && payload.assumptions.products.length > 0) {
    return payload.assumptions.products
      .map((productName) => String(productName ?? '').trim())
      .filter(Boolean)
      .map((product_name) => ({ product_name, aliases: [] }))
  }

  return []
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRouteSession(req, { includeProfile: false })
    if (auth.response) return auth.response
    const { supabase, user } = auth.session

    const body = (await req.json()) as AudioTranscriptImportPayload
    const chunks = normalizeImportChunks(body)
    const importCatalogProducts = deriveImportCatalogProducts(body)
    const sessionWindow = deriveSessionWindow(chunks)
    const requestedStatus = normalizeText(body.session?.status) as AudioCaptureSessionStatus | null
    const sessionStatus =
      requestedStatus && VALID_AUDIO_SESSION_STATUSES.has(requestedStatus)
        ? requestedStatus
        : 'completed'

    const { data: session, error: sessionError } = await (supabase as any)
      .from('audio_capture_sessions')
      .insert([
        {
          user_id: user.id,
          status: sessionStatus,
          device_label: normalizeText(body.session?.device_label) ?? normalizeText(body.source_label) ?? 'transcript import',
          microphone_label: normalizeText(body.session?.microphone_label) ?? 'imported transcript',
          notes: normalizeText(body.session?.notes),
          started_at: toIsoOrNull(body.session?.started_at) ?? sessionWindow.startedAt,
          ended_at: toIsoOrNull(body.session?.ended_at) ?? sessionWindow.endedAt,
        },
      ])
      .select('*')
      .single()

    if (sessionError) {
      return apiError(sessionError.message)
    }

    let transcriptCount = 0
    let orderEventCount = 0

    for (const chunk of chunks) {
      const chunkWindow = deriveChunkWindow(chunk)
      const { data: createdChunk, error: chunkError } = await (supabase as any)
        .from('audio_capture_chunks')
        .insert([
          {
            session_id: session.id,
            user_id: user.id,
            started_at: chunkWindow.startedAt,
            ended_at: chunkWindow.endedAt,
            duration_sec: chunkWindow.durationSec,
            upload_status: 'uploaded',
            transcription_status: 'pending',
          },
        ])
        .select('*')
        .single()

      if (chunkError) {
        return apiError(chunkError.message)
      }

      const result = await persistAudioTranscriptsWithEvents(
        supabase,
        user.id,
        session.id,
        createdChunk.id,
        chunk.transcripts,
        {
          importCatalogProducts,
        }
      )

      transcriptCount += result.transcripts.length
      orderEventCount += result.orderEventCount
    }

    const payload: AudioTranscriptImportResultPayload = {
      session,
      chunk_count: chunks.length,
      transcript_count: transcriptCount,
      order_event_count: orderEventCount,
    }

    return apiOk(payload)
  } catch (error) {
    if (error instanceof Error) {
      return apiError(error.message, 400)
    }
    console.error('[audio/import-transcripts POST]', error)
    return apiError('サーバーエラー')
  }
}
