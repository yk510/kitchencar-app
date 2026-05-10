import { NextRequest } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import type {
  AudioChunkCreatePayload,
  AudioChunkListPayload,
  AudioChunkMutationPayload,
  AudioChunkTranscriptionStatus,
  AudioChunkUploadStatus,
} from '@/types/audio-analytics'

const VALID_AUDIO_CHUNK_UPLOAD_STATUSES = new Set<AudioChunkUploadStatus>([
  'pending',
  'uploaded',
  'failed',
])

const VALID_AUDIO_CHUNK_TRANSCRIPTION_STATUSES = new Set<AudioChunkTranscriptionStatus>([
  'pending',
  'processing',
  'completed',
  'failed',
])

function normalizeTextField(value: unknown) {
  const text = String(value ?? '').trim()
  return text || null
}

function parseIsoDateTime(value: unknown, fieldName: string) {
  const text = String(value ?? '').trim()
  if (!text) {
    throw new Error(`${fieldName} は必須です`)
  }

  const parsed = new Date(text)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldName} は ISO 形式の日付文字列で指定してください`)
  }

  return parsed.toISOString()
}

export async function GET(req: NextRequest) {
  const auth = await requireRouteSession(req, { includeProfile: false })
  if (auth.response) return auth.response
  const { supabase, user } = auth.session

  const sessionId = normalizeTextField(req.nextUrl.searchParams.get('session_id'))
  const uploadStatus = normalizeTextField(req.nextUrl.searchParams.get('upload_status'))
  const transcriptionStatus = normalizeTextField(req.nextUrl.searchParams.get('transcription_status'))
  const limitRaw = Number.parseInt(req.nextUrl.searchParams.get('limit') ?? '50', 10)
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50

  let query = (supabase as any)
    .from('audio_capture_chunks')
    .select('*')
    .eq('user_id', user.id)
    .order('started_at', { ascending: false })
    .limit(limit)

  if (sessionId) {
    query = query.eq('session_id', sessionId)
  }

  if (uploadStatus) {
    if (!VALID_AUDIO_CHUNK_UPLOAD_STATUSES.has(uploadStatus as AudioChunkUploadStatus)) {
      return apiError('upload_status が不正です', 400)
    }
    query = query.eq('upload_status', uploadStatus)
  }

  if (transcriptionStatus) {
    if (!VALID_AUDIO_CHUNK_TRANSCRIPTION_STATUSES.has(transcriptionStatus as AudioChunkTranscriptionStatus)) {
      return apiError('transcription_status が不正です', 400)
    }
    query = query.eq('transcription_status', transcriptionStatus)
  }

  const { data, error } = await query
  if (error) {
    return apiError(error.message)
  }

  const payload: AudioChunkListPayload = {
    chunks: data ?? [],
  }

  return apiOk(payload)
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRouteSession(req, { includeProfile: false })
    if (auth.response) return auth.response
    const { supabase, user } = auth.session

    const body = (await req.json()) as AudioChunkCreatePayload
    const sessionId = normalizeTextField(body.session_id)
    if (!sessionId) {
      return apiError('session_id は必須です', 400)
    }

    const startedAt = parseIsoDateTime(body.started_at, 'started_at')
    const endedAt = parseIsoDateTime(body.ended_at, 'ended_at')
    const durationSec = Number(body.duration_sec)

    if (!Number.isFinite(durationSec) || durationSec <= 0) {
      return apiError('duration_sec は 1 以上の数値で指定してください', 400)
    }

    const uploadStatus = body.upload_status ?? 'pending'
    if (!VALID_AUDIO_CHUNK_UPLOAD_STATUSES.has(uploadStatus)) {
      return apiError('upload_status が不正です', 400)
    }

    const transcriptionStatus = body.transcription_status ?? 'pending'
    if (!VALID_AUDIO_CHUNK_TRANSCRIPTION_STATUSES.has(transcriptionStatus)) {
      return apiError('transcription_status が不正です', 400)
    }

    const { data: session, error: sessionError } = await (supabase as any)
      .from('audio_capture_sessions')
      .select('id, user_id')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (sessionError) {
      return apiError(sessionError.message)
    }

    if (!session) {
      return apiError('対象の session が見つかりません', 404)
    }

    const { data, error } = await (supabase as any)
      .from('audio_capture_chunks')
      .insert([
        {
          session_id: sessionId,
          user_id: user.id,
          started_at: startedAt,
          ended_at: endedAt,
          duration_sec: Math.round(durationSec),
          storage_bucket: normalizeTextField(body.storage_bucket),
          storage_path: normalizeTextField(body.storage_path),
          audio_file_url: normalizeTextField(body.audio_file_url),
          upload_status: uploadStatus,
          transcription_status: transcriptionStatus,
        },
      ])
      .select('*')
      .single()

    if (error) {
      return apiError(error.message)
    }

    const payload: AudioChunkMutationPayload = {
      chunk: data,
    }

    return apiOk(payload)
  } catch (error) {
    if (error instanceof Error) {
      return apiError(error.message, 400)
    }
    console.error('[audio/chunks POST]', error)
    return apiError('サーバーエラー')
  }
}
