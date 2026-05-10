import { NextRequest } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import type {
  AudioCaptureSessionStatus,
  AudioSessionCreatePayload,
  AudioSessionListPayload,
  AudioSessionMutationPayload,
  AudioSessionUpdatePayload,
} from '@/types/audio-analytics'

const VALID_AUDIO_SESSION_STATUSES = new Set<AudioCaptureSessionStatus>([
  'recording',
  'paused',
  'completed',
  'failed',
])

function normalizeTextField(value: unknown) {
  const text = String(value ?? '').trim()
  return text || null
}

type ParsedEndedAtResult =
  | { value: string | null }
  | { error: string }

function parseEndedAt(value: unknown): ParsedEndedAtResult {
  if (value == null || value === '') {
    return { value: null as string | null }
  }

  const isoText = String(value).trim()
  const parsed = new Date(isoText)
  if (Number.isNaN(parsed.getTime())) {
    return { error: 'ended_at は ISO 形式の日付文字列で指定してください' as const }
  }

  return { value: parsed.toISOString() }
}

export async function GET(req: NextRequest) {
  const auth = await requireRouteSession(req, { includeProfile: false })
  if (auth.response) return auth.response
  const { supabase, user } = auth.session

  const status = normalizeTextField(req.nextUrl.searchParams.get('status'))
  const limitRaw = Number.parseInt(req.nextUrl.searchParams.get('limit') ?? '20', 10)
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 20

  let query = (supabase as any)
    .from('audio_capture_sessions')
    .select('*')
    .eq('user_id', user.id)
    .order('started_at', { ascending: false })
    .limit(limit)

  if (status) {
    if (!VALID_AUDIO_SESSION_STATUSES.has(status as AudioCaptureSessionStatus)) {
      return apiError('status が不正です', 400)
    }
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) {
    return apiError(error.message)
  }

  const payload: AudioSessionListPayload = {
    sessions: data ?? [],
  }
  return apiOk(payload)
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRouteSession(req, { includeProfile: false })
    if (auth.response) return auth.response
    const { supabase, user } = auth.session

    const body = (await req.json()) as AudioSessionCreatePayload
    const deviceLabel = normalizeTextField(body.device_label)
    const microphoneLabel = normalizeTextField(body.microphone_label)
    const notes = normalizeTextField(body.notes)

    const { data, error } = await (supabase as any)
      .from('audio_capture_sessions')
      .insert([
        {
          user_id: user.id,
          status: 'recording',
          device_label: deviceLabel,
          microphone_label: microphoneLabel,
          notes,
        },
      ])
      .select('*')
      .single()

    if (error) {
      return apiError(error.message)
    }

    const payload: AudioSessionMutationPayload = {
      session: data,
    }
    return apiOk(payload)
  } catch (error) {
    console.error('[audio/sessions POST]', error)
    return apiError('サーバーエラー')
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const auth = await requireRouteSession(req, { includeProfile: false })
    if (auth.response) return auth.response
    const { supabase, user } = auth.session

    const body = (await req.json()) as AudioSessionUpdatePayload & { session_id?: string }
    const sessionId = normalizeTextField(body.session_id)
    if (!sessionId) {
      return apiError('session_id は必須です', 400)
    }

    const updates: Record<string, unknown> = {}

    if (body.status != null) {
      if (!VALID_AUDIO_SESSION_STATUSES.has(body.status)) {
        return apiError('status が不正です', 400)
      }
      updates.status = body.status
    }

    if ('notes' in body) {
      updates.notes = normalizeTextField(body.notes)
    }

    if ('ended_at' in body) {
      const parsedEndedAt = parseEndedAt(body.ended_at)
      if ('error' in parsedEndedAt) {
        return apiError(parsedEndedAt.error, 400)
      }
      updates.ended_at = parsedEndedAt.value
    }

    if (Object.keys(updates).length === 0) {
      return apiError('更新内容がありません', 400)
    }

    const { data, error } = await (supabase as any)
      .from('audio_capture_sessions')
      .update(updates)
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .select('*')
      .single()

    if (error) {
      return apiError(error.message)
    }

    const payload: AudioSessionMutationPayload = {
      session: data,
    }
    return apiOk(payload)
  } catch (error) {
    console.error('[audio/sessions PATCH]', error)
    return apiError('サーバーエラー')
  }
}
