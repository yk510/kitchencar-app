export function normalizeAnalyticsDate(value?: string): string | undefined {
  if (!value) return undefined

  const normalized = value.replace(/\//g, '-').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return undefined
  }

  return normalized
}
