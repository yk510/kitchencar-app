import { NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { requireRouteSession } from '@/lib/auth'
import { createForecastForPlanDay } from '@/lib/forecast'
import { geocodeAddress } from '@/lib/geocode'
import { apiError, apiOk } from '@/lib/api-response'
import type { PlansListPayload, PlansSaveApiPayload } from '@/types/api-payloads'

function normalizeMunicipality(address: string) {
  const trimmed = address.trim().replace(/\s+/g, '')

  const fullMatch = trimmed.match(/^.*?[都道府県].*?[市区町村]/)
  if (fullMatch) return fullMatch[0]

  const fallbackMatch = trimmed.match(/^.*?[市区町村]/)
  return fallbackMatch ? fallbackMatch[0] : trimmed
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRouteSession(req)
    if (auth.response) return auth.response
    const { supabase } = auth.session

    const { data: plans, error } = await (supabase as any)
      .from('operation_plans')
      .select(`
        id,
        plan_month,
        title,
        source_image_name,
        status,
        created_at,
        operation_plan_days (
          id,
          plan_date,
        operation_type,
        holiday_flag,
        location_id,
        location_name,
        municipality,
          event_name,
          business_start_time,
          business_end_time,
          notes
        )
      `)
      .order('plan_month', { ascending: false })

    if (error) {
      return apiError(error.message)
    }

    const payload: PlansListPayload = plans ?? []
    return apiOk(payload)
  } catch (error) {
    console.error('[plans GET]', error)
    return apiError('サーバーエラー')
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRouteSession(req)
    if (auth.response) return auth.response
    const { supabase, user } = auth.session

    const { title, plan_month, source_image_name, days } = await req.json()

    if (!plan_month || !Array.isArray(days) || days.length === 0) {
      return apiError('予定データが不足しています', 400)
    }

    const { data: plan, error: planErr } = await (supabase as any)
      .from('operation_plans')
      .insert([
        {
          user_id: user.id,
          title: title ?? null,
          plan_month,
          source_image_name: source_image_name ?? null,
          status: 'confirmed',
        },
      ])
      .select()
      .single()

    if (planErr || !plan) {
      return apiError(planErr?.message ?? '予定の保存に失敗しました')
    }

    const normalizedDays = []

    for (const day of days as any[]) {
      const operationType =
        day.operation_type === 'closed'
          ? 'closed'
          : day.event_name?.trim()
          ? 'event'
          : 'open'

      const locationName = day.location_name?.trim() || null
      const municipality = day.municipality?.trim()
        ? normalizeMunicipality(day.municipality)
        : null
      let locationId = day.location_id ?? null

      if (operationType !== 'closed' && (!locationName || !municipality)) {
        return apiError('通常営業またはイベント営業では、出店場所と市町村が必須です', 400)
      }

      if (!locationId && locationName && municipality) {
        let latitude: number | null = null
        let longitude: number | null = null

        const geo = await geocodeAddress(municipality)
        if (geo) {
          latitude = geo.latitude
          longitude = geo.longitude
        }

        const { data: location, error: locationError } = await (supabase as any)
          .from('locations')
          .upsert(
            [
              {
                user_id: user.id,
                name: locationName,
                address: municipality,
                latitude,
                longitude,
              },
            ],
            { onConflict: 'user_id,name,address' }
          )
          .select('id')
          .single()

        if (locationError) {
          return apiError(locationError.message)
        }

        locationId = location?.id ?? null
      }

      normalizedDays.push({
        user_id: user.id,
        plan_id: plan.id,
        plan_date: day.plan_date ?? day.date,
        operation_type: operationType,
        holiday_flag: day.holiday_flag?.trim() || null,
        location_id: locationId,
        location_name: operationType === 'closed' ? null : locationName,
        municipality: operationType === 'closed' ? null : municipality,
        event_name: day.event_name?.trim() || null,
        business_start_time: day.business_start_time ?? null,
        business_end_time: day.business_end_time ?? null,
        ai_source_text: day.ai_source_text ?? null,
        ai_confidence: day.ai_confidence ?? null,
        notes: day.notes ?? null,
      })
    }

    const { data: insertedDays, error: dayErr } = await (supabase as any)
      .from('operation_plan_days')
      .insert(normalizedDays)
      .select()

    if (dayErr || !insertedDays) {
      return apiError(dayErr?.message ?? '予定日の保存に失敗しました')
    }

    for (const day of insertedDays as any[]) {
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
    revalidatePath('/plans/new')
    revalidatePath('/analytics/daily')
    revalidatePath('/locations')

    const payload: PlansSaveApiPayload = { plan_id: plan.id }
    return apiOk(payload)
  } catch (error) {
    console.error('[plans POST]', error)
    return apiError('サーバーエラー')
  }
}
