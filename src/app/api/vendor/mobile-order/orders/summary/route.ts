import { NextRequest } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import {
  fetchVendorOrderCounts,
  resolveVendorOrderDashboardContext,
} from '@/lib/vendor-mobile-order-dashboard'
import type { VendorMobileOrderOrdersSummaryPayload } from '@/types/api-payloads'

export async function GET(req: NextRequest) {
  const auth = await requireRouteSession(req)
  if (auth.response) return auth.response

  if (auth.session.role !== 'vendor') {
    return apiError('ベンダー権限が必要です', 403)
  }

  const { supabase, user } = auth.session
  const requestedScheduleId = req.nextUrl.searchParams.get('schedule_id')

  try {
    const { store, selectedSchedule } = await resolveVendorOrderDashboardContext(
      supabase,
      user,
      requestedScheduleId
    )

    const counts = await fetchVendorOrderCounts(supabase, store.id, selectedSchedule?.id ?? null)
    const payload: VendorMobileOrderOrdersSummaryPayload = counts
    return apiOk(payload)
  } catch (error) {
    console.error('[vendor/mobile-order/orders/summary GET]', error)
    return apiError(error instanceof Error ? error.message : 'サーバーエラー')
  }
}
