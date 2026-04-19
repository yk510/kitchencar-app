import { NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { requireRouteSession } from '@/lib/auth'
import { createForecastForPlanDay } from '@/lib/forecast'
import { apiError, apiOk } from '@/lib/api-response'
import type { PlanForecastRunPayload } from '@/types/api-payloads'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireRouteSession(req)
    if (auth.response) return auth.response
    const { supabase } = auth.session

    const { data: days, error } = await (supabase as any)
      .from('operation_plan_days')
      .select('*')
      .eq('plan_id', params.id)

    if (error) {
      return apiError(error.message)
    }

    for (const day of (days ?? []) as any[]) {
      await createForecastForPlanDay(supabase, {
        user_id: day.user_id,
        plan_day_id: day.id,
        plan_date: day.plan_date,
        operation_type: day.operation_type,
        location_id: day.location_id,
        location_name: day.location_name,
        municipality: day.municipality,
        event_name: day.event_name,
      })
    }

    revalidatePath('/plans')
    const payload: PlanForecastRunPayload = { success: true }
    return apiOk(payload)
  } catch (error) {
    console.error('[plans/[id]/forecast POST]', error)
    return apiError('サーバーエラー')
  }
}
