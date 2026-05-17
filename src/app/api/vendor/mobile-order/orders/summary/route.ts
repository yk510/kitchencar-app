import { NextRequest } from 'next/server'
import { getVendorOrderDashboardSummaryPayload } from '@/lib/vendor-mobile-order-dashboard-api'
import { executeVendorMobileOrderRoute } from '@/lib/vendor-mobile-order-route'

export async function GET(req: NextRequest) {
  const requestedScheduleId = req.nextUrl.searchParams.get('schedule_id')
  return executeVendorMobileOrderRoute(req, '[vendor/mobile-order/orders/summary GET]', async ({ supabase, user }) =>
    getVendorOrderDashboardSummaryPayload(supabase, user, requestedScheduleId)
  )
}
