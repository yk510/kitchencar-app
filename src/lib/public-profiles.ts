import type { OrganizerPublicProfile, VendorPublicProfile } from '@/types/marketplace'

export async function getOrganizerPublicProfile(supabase: any, userId: string): Promise<OrganizerPublicProfile | null> {
  const { data } = await supabase.rpc('get_organizer_public_profile', { target_user_id: userId }).maybeSingle()

  if (!data) return null

  return {
    user_id: userId,
    organizer_name: data.organizer_name ?? '主催者',
    contact_name: data.contact_name ?? null,
    logo_image_url: data.logo_image_url ?? null,
    instagram_url: data.instagram_url ?? null,
    x_url: data.x_url ?? null,
    description: data.description ?? null,
  }
}

export async function getOrganizerPublicProfiles(supabase: any, userIds: string[]) {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)))
  if (uniqueUserIds.length === 0) return new Map<string, OrganizerPublicProfile>()

  const { data } = await supabase
    .from('organizer_profiles')
    .select('user_id, organizer_name, contact_name, logo_image_url, instagram_url, x_url, description')
    .in('user_id', uniqueUserIds)

  return new Map<string, OrganizerPublicProfile>(
    ((data ?? []) as any[]).map((row) => [
      row.user_id,
      {
        user_id: row.user_id,
        organizer_name: row.organizer_name ?? '主催者',
        contact_name: row.contact_name ?? null,
        logo_image_url: row.logo_image_url ?? null,
        instagram_url: row.instagram_url ?? null,
        x_url: row.x_url ?? null,
        description: row.description ?? null,
      },
    ])
  )
}

export async function getVendorPublicProfile(supabase: any, userId: string): Promise<VendorPublicProfile | null> {
  const { data } = await supabase.rpc('get_vendor_public_profile', { target_user_id: userId }).maybeSingle()

  if (!data) return null

  return {
    user_id: userId,
    business_name: data.business_name ?? '事業者',
    owner_name: data.owner_name ?? null,
    contact_email: data.contact_email ?? null,
    phone: data.phone ?? null,
    genre: data.genre ?? null,
    main_menu: data.main_menu ?? null,
    logo_image_url: data.logo_image_url ?? null,
    instagram_url: data.instagram_url ?? null,
    x_url: data.x_url ?? null,
    description: data.description ?? null,
  }
}

export async function getVendorPublicProfiles(supabase: any, userIds: string[]) {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)))
  if (uniqueUserIds.length === 0) return new Map<string, VendorPublicProfile>()

  const profiles = await Promise.all(uniqueUserIds.map((userId) => getVendorPublicProfile(supabase, userId)))

  return new Map<string, VendorPublicProfile>(
    profiles
      .filter((profile): profile is VendorPublicProfile => !!profile)
      .map((profile) => [profile.user_id, profile])
  )
}
