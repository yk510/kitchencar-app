import { formatVendorHourlyAnalyticsPayload, formatVendorProductAnalyticsPayload, formatVendorWeekdayAnalyticsPayload } from '@/lib/vendor-analytics-formatters'
import { getVendorHourlyAnalytics } from '@/lib/vendor-hourly-analytics'
import { getVendorProductAnalytics } from '@/lib/vendor-product-analytics'
import { getVendorWeekdayAnalytics } from '@/lib/vendor-weekday-analytics'

export async function loadVendorProductAnalyticsPayload(
  supabase: any,
  userId: string,
  scope: Parameters<typeof getVendorProductAnalytics>[2],
  start?: string,
  end?: string
) {
  const rows = await getVendorProductAnalytics(supabase, userId, scope, start, end)
  return formatVendorProductAnalyticsPayload(rows)
}

export async function loadVendorHourlyAnalyticsPayload(
  supabase: any,
  userId: string,
  scope: Parameters<typeof getVendorHourlyAnalytics>[2],
  start?: string,
  end?: string
) {
  const rows = await getVendorHourlyAnalytics(supabase, userId, scope, start, end)
  return formatVendorHourlyAnalyticsPayload(rows.rows, rows.heatmap)
}

export async function loadVendorWeekdayAnalyticsPayload(
  supabase: any,
  userId: string,
  scope: Parameters<typeof getVendorWeekdayAnalytics>[2],
  start?: string,
  end?: string
) {
  const rows = await getVendorWeekdayAnalytics(supabase, userId, scope, start, end)
  return formatVendorWeekdayAnalyticsPayload(rows)
}
