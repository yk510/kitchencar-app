import { NextRequest } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import type { PlansReferenceApiPayload } from '@/types/api-payloads'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRouteSession(req)
    if (auth.response) return auth.response
    const { supabase } = auth.session

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
      return apiError(locationError.message)
    }

    if (eventError) {
      return apiError(eventError.message)
    }

    const eventNames = Array.from(
      new Set(
        ((events ?? []) as Array<{ event_name: string | null }>)
          .map((event) => event.event_name?.trim())
          .filter((eventName): eventName is string => Boolean(eventName))
      )
    )

    const payload: PlansReferenceApiPayload = {
      locations: locations ?? [],
      eventNames,
    }

    return apiOk(payload)
  } catch (error) {
    console.error('[plans/reference GET]', error)
    return apiError('サーバーエラー')
  }
}
