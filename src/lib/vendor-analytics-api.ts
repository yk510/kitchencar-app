import { NextRequest } from 'next/server'
import { normalizeAnalyticsDate } from '@/lib/analytics-date'
import { requireRouteSession } from '@/lib/auth'
import { apiError } from '@/lib/api-response'
import { normalizeAnalyticsScope } from '@/lib/vendor-product-analytics'

export type VendorAnalyticsRouteContext = {
  supabase: any
  userId: string
  scope: ReturnType<typeof normalizeAnalyticsScope>
  start?: string
  end?: string
}

export async function requireVendorAnalyticsRouteContext(req: NextRequest): Promise<
  | { response: Response; context?: undefined }
  | { response?: undefined; context: VendorAnalyticsRouteContext }
> {
  const auth = await requireRouteSession(req)
  if (auth.response) return { response: auth.response }

  if (auth.session.role !== 'vendor') {
    return { response: apiError('ベンダー権限が必要です', 403) }
  }

  return {
    context: {
      supabase: auth.session.supabase,
      userId: auth.session.user.id,
      scope: normalizeAnalyticsScope(req.nextUrl.searchParams.get('scope') ?? undefined),
      start: normalizeAnalyticsDate(req.nextUrl.searchParams.get('start') ?? undefined),
      end: normalizeAnalyticsDate(req.nextUrl.searchParams.get('end') ?? undefined),
    },
  }
}
