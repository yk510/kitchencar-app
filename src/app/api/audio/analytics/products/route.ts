import { NextRequest } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import { normalizeAnalyticsDate } from '@/lib/analytics-date'
import type {
  AudioAnalyticsProductRow,
  AudioAnalyticsProductsPayload,
} from '@/types/audio-analytics'

function normalizeId(value: string | null) {
  const text = String(value ?? '').trim()
  return text || null
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
    .select('product_id, normalized_product_name, quantity, event_at, session_id')
    .eq('user_id', user.id)
    .order('event_at', { ascending: false })

  if (start) query = query.gte('event_at', `${start}T00:00:00.000Z`)
  if (end) query = query.lte('event_at', `${end}T23:59:59.999Z`)
  if (sessionId) query = query.eq('session_id', sessionId)

  const { data, error } = await query
  if (error) {
    return apiError(error.message)
  }

  const aggregate = new Map<string, AudioAnalyticsProductRow>()
  for (const row of (data ?? []) as any[]) {
    const productKey = String(row.product_id ?? row.normalized_product_name ?? '')
    const productName = String(row.normalized_product_name ?? '').trim() || '未解決商品'
    const quantity = Number(row.quantity ?? 0)
    if (!productKey || quantity <= 0) continue

    const current = aggregate.get(productKey) ?? {
      product_id: row.product_id ?? null,
      product_name: productName,
      total_quantity: 0,
      order_event_count: 0,
    }

    current.total_quantity += quantity
    current.order_event_count += 1
    aggregate.set(productKey, current)
  }

  const payload: AudioAnalyticsProductsPayload = {
    rows: Array.from(aggregate.values()).sort((left, right) => {
      if (right.total_quantity !== left.total_quantity) {
        return right.total_quantity - left.total_quantity
      }
      return right.order_event_count - left.order_event_count
    }),
  }

  return apiOk(payload)
}
