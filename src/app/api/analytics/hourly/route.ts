import { NextRequest } from 'next/server'
import { apiError, apiOk } from '@/lib/api-response'
import { requireVendorAnalyticsRouteContext } from '@/lib/vendor-analytics-api'
import { loadVendorHourlyAnalyticsPayload } from '@/lib/vendor-analytics-loaders'
export async function GET(req: NextRequest) {
  const resolved = await requireVendorAnalyticsRouteContext(req)
  if (resolved.response) return resolved.response
  const { supabase, userId, scope, start, end } = resolved.context

  try {
    return apiOk(await loadVendorHourlyAnalyticsPayload(supabase, userId, scope, start, end))
  } catch (error) {
    return apiError(error instanceof Error ? error.message : 'サーバーエラー')
  }
}
