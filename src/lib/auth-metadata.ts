type MetadataRecord = Record<string, unknown>

function isRecord(value: unknown): value is MetadataRecord {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function sanitizeOnboardingProfile(value: unknown) {
  if (!isRecord(value)) return null

  const sanitized: MetadataRecord = {}

  for (const [key, entry] of Object.entries(value)) {
    if (key === 'logo_image_url') continue
    sanitized[key] = entry
  }

  return sanitized
}

export function buildCompactAuthMetadata(
  metadata: unknown,
  fallback: {
    role?: string | null
    displayName?: string | null
    onboardingProfile?: Record<string, unknown> | null
  } = {}
) {
  const source = isRecord(metadata) ? metadata : {}
  const compact: MetadataRecord = {}

  const role =
    typeof source.role === 'string'
      ? source.role
      : typeof fallback.role === 'string'
        ? fallback.role
        : null

  const displayName =
    typeof source.display_name === 'string'
      ? source.display_name
      : typeof fallback.displayName === 'string'
        ? fallback.displayName
        : null

  if (role) compact.role = role
  if (displayName) compact.display_name = displayName

  const onboardingProfile =
    sanitizeOnboardingProfile(source.onboarding_profile) ??
    sanitizeOnboardingProfile(fallback.onboardingProfile)

  if (onboardingProfile && Object.keys(onboardingProfile).length > 0) {
    compact.onboarding_profile = onboardingProfile
  }

  return compact
}

export function needsAuthMetadataCompaction(metadata: unknown) {
  if (!isRecord(metadata)) return false

  const onboardingProfile = metadata.onboarding_profile
  if (!isRecord(onboardingProfile)) return false

  return typeof onboardingProfile.logo_image_url === 'string' && onboardingProfile.logo_image_url.length > 0
}
