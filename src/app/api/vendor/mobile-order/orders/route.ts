import { NextRequest } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import { ensureVendorStoreResources, resolveActiveSchedule } from '@/lib/mobile-order'
import type {
  StoreOrderScheduleRow,
  VendorMobileOrderDashboardOrder,
  VendorMobileOrderOrdersPayload,
} from '@/types/api-payloads'

function pickSelectedSchedule(schedules: StoreOrderScheduleRow[], requestedScheduleId: string | null) {
  if (requestedScheduleId) {
    return schedules.find((schedule) => schedule.id === requestedScheduleId) ?? null
  }

  const activeSchedule = resolveActiveSchedule([...schedules].sort((a, b) => new Date(a.opens_at).getTime() - new Date(b.opens_at).getTime()))
  if (activeSchedule) return activeSchedule

  return schedules[0] ?? null
}

export async function GET(req: NextRequest) {
  const auth = await requireRouteSession(req)
  if (auth.response) return auth.response

  if (auth.session.role !== 'vendor') {
    return apiError('ベンダー権限が必要です', 403)
  }

  const { supabase, user } = auth.session
  const requestedScheduleId = req.nextUrl.searchParams.get('schedule_id')

  const { data: vendorProfile } = await (supabase as any)
    .from('vendor_profiles')
    .select('business_name')
    .eq('user_id', user.id)
    .maybeSingle()

  try {
    const { store } = await ensureVendorStoreResources(supabase, user, {
      businessName: vendorProfile?.business_name ?? null,
    })

    const { data: schedules, error: schedulesError } = await (supabase as any)
      .from('store_order_schedules')
      .select('*')
      .eq('store_id', store.id)
      .order('opens_at', { ascending: false })

    if (schedulesError) {
      return apiError(schedulesError.message)
    }

    const normalizedSchedules = (schedules ?? []) as StoreOrderScheduleRow[]
    const selectedSchedule = pickSelectedSchedule(normalizedSchedules, requestedScheduleId)

    let orders: VendorMobileOrderDashboardOrder[] = []

    if (selectedSchedule) {
      const { data, error } = await (supabase as any)
        .from('mobile_orders')
        .select('*, mobile_order_items(*, mobile_order_item_option_choices(*)), mobile_order_notifications(*)')
        .eq('store_id', store.id)
        .eq('schedule_id', selectedSchedule.id)
        .in('payment_status', ['paid', 'authorized'])
        .order('ordered_at', { ascending: false })

      if (error) {
        return apiError(error.message)
      }

      orders = (data ?? []) as VendorMobileOrderDashboardOrder[]
    }

    const payload: VendorMobileOrderOrdersPayload = {
      store,
      schedules: normalizedSchedules,
      selectedSchedule,
      orders,
    }

    return apiOk(payload)
  } catch (error) {
    console.error('[vendor/mobile-order/orders GET]', error)
    return apiError(error instanceof Error ? error.message : 'サーバーエラー')
  }
}
