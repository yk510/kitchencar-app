import { NextRequest } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import type { NotificationsUnreadCountPayload } from '@/types/api-payloads'

export async function GET(req: NextRequest) {
  const auth = await requireRouteSession(req)
  if (auth.response) return auth.response
  const { supabase, user, role } = auth.session

  const { data: applications, error: applicationsError } = await (supabase as any)
    .from('event_applications')
    .select('id')
    .eq(role === 'organizer' ? 'organizer_user_id' : 'vendor_user_id', user.id)

  if (applicationsError) {
    return apiError(applicationsError.message)
  }

  const applicationIds = (applications ?? []).map((row: any) => row.id)
  if (applicationIds.length === 0) {
    const payload: NotificationsUnreadCountPayload = { count: 0 }
    return apiOk(payload)
  }

  const { data: messages, error } = await (supabase as any)
    .from('application_messages')
    .select('id, sender_role, read_by_vendor_at, read_by_organizer_at')
    .in('application_id', applicationIds)

  if (error) {
    return apiError(error.message)
  }

  const count = (messages ?? []).filter((message: any) =>
    role === 'organizer'
      ? message.sender_role === 'vendor' && !message.read_by_organizer_at
      : message.sender_role === 'organizer' && !message.read_by_vendor_at
  ).length

  const payload: NotificationsUnreadCountPayload = { count }
  return apiOk(payload)
}
