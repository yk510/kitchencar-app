export type AnalyticsScopeFilter = 'all' | 'normal' | 'event'

export type StallLogResolution = {
  locationId: string | null
  eventId: string | null
}

export function buildStallLogResolutionMap(
  rows: Array<{ log_date: string; location_id?: string | null; event_id?: string | null }>
) {
  const map = new Map<string, StallLogResolution>()

  for (const row of rows) {
    map.set(row.log_date, {
      locationId: row.location_id ?? null,
      eventId: row.event_id ?? null,
    })
  }

  return map
}

export function resolveAnalyticsLocationId(
  txnDate: string | null | undefined,
  explicitLocationId: string | null | undefined,
  stallLogByDate: Map<string, StallLogResolution>
) {
  if (explicitLocationId) return explicitLocationId
  if (!txnDate) return null
  return stallLogByDate.get(txnDate)?.locationId ?? null
}

export function resolveAnalyticsEventId(
  txnDate: string | null | undefined,
  explicitEventId: string | null | undefined,
  stallLogByDate: Map<string, StallLogResolution>
) {
  if (explicitEventId) return explicitEventId
  if (!txnDate) return null
  return stallLogByDate.get(txnDate)?.eventId ?? null
}

export function matchesAnalyticsScope(
  scope: AnalyticsScopeFilter,
  resolvedEventId: string | null | undefined
) {
  if (scope === 'all') return true
  if (scope === 'normal') return resolvedEventId == null
  return resolvedEventId != null
}
