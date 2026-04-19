import { getOrganizerPublicProfiles, getVendorPublicProfiles } from '@/lib/public-profiles'

export async function buildApplicationRows(supabase: any, applications: any[], role: 'vendor' | 'organizer') {
  const offerIds = Array.from(new Set((applications ?? []).map((row: any) => row.offer_id)))
  const organizerIds =
    role === 'vendor'
      ? Array.from(new Set((applications ?? []).map((row: any) => row.organizer_user_id)))
      : []
  const vendorIds =
    role === 'organizer'
      ? Array.from(new Set((applications ?? []).map((row: any) => row.vendor_user_id)))
      : []

  const [offersResult, organizerMap, vendorMap, unreadResult] = await Promise.all([
    offerIds.length > 0
      ? supabase
          .from('event_offers')
          .select('id, title, event_date, event_end_date, venue_name, municipality, status')
          .in('id', offerIds)
      : Promise.resolve({ data: [], error: null }),
    getOrganizerPublicProfiles(supabase, organizerIds),
    getVendorPublicProfiles(supabase, vendorIds),
    offerIds.length > 0 || (applications ?? []).length > 0
      ? supabase
          .from('application_messages')
          .select('id, application_id, read_by_vendor_at, read_by_organizer_at, sender_role')
          .in(
            'application_id',
            (applications ?? []).map((row: any) => row.id)
          )
      : Promise.resolve({ data: [], error: null }),
  ])

  const unreadRows = (unreadResult.data ?? []) as any[]
  const unreadMap = new Map<string, number>()
  for (const row of unreadRows) {
    const unread =
      role === 'organizer'
        ? row.sender_role === 'vendor' && !row.read_by_organizer_at
        : row.sender_role === 'organizer' && !row.read_by_vendor_at
    if (!unread) continue
    unreadMap.set(row.application_id, (unreadMap.get(row.application_id) ?? 0) + 1)
  }

  const offerMap = new Map<string, any>((offersResult.data ?? []).map((row: any) => [row.id, row]))

  return (applications ?? []).map((application: any) => ({
    ...application,
    offer: offerMap.get(application.offer_id) ?? null,
    organizer_name:
      role === 'vendor'
        ? organizerMap.get(application.organizer_user_id)?.organizer_name ?? '主催者'
        : null,
    vendor_name:
      role === 'organizer'
        ? vendorMap.get(application.vendor_user_id)?.business_name ?? application.vendor_business_name
        : null,
    vendor_business_name:
      role === 'organizer'
        ? vendorMap.get(application.vendor_user_id)?.business_name ?? application.vendor_business_name
        : application.vendor_business_name,
    vendor_contact_name:
      role === 'organizer'
        ? vendorMap.get(application.vendor_user_id)?.owner_name ?? application.vendor_contact_name
        : application.vendor_contact_name,
    vendor_contact_email:
      role === 'organizer'
        ? vendorMap.get(application.vendor_user_id)?.contact_email ?? application.vendor_contact_email
        : application.vendor_contact_email,
    vendor_phone:
      role === 'organizer'
        ? vendorMap.get(application.vendor_user_id)?.phone ?? application.vendor_phone
        : application.vendor_phone,
    unread_count: unreadMap.get(application.id) ?? 0,
  }))
}
