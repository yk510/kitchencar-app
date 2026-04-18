import { NextRequest, NextResponse } from 'next/server'
import { requireRouteSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = await requireRouteSession(req)
  if (auth.response) return auth.response
  const { supabase, user, role } = auth.session

  const { data: applications, error: applicationsError } = await (supabase as any)
    .from('event_applications')
    .select('id')
    .eq(role === 'organizer' ? 'organizer_user_id' : 'vendor_user_id', user.id)

  if (applicationsError) {
    return NextResponse.json({ error: applicationsError.message }, { status: 500 })
  }

  const applicationIds = (applications ?? []).map((row: any) => row.id)
  if (applicationIds.length === 0) {
    return NextResponse.json({ count: 0 })
  }

  const { data: messages, error } = await (supabase as any)
    .from('application_messages')
    .select('id, sender_role, read_by_vendor_at, read_by_organizer_at')
    .in('application_id', applicationIds)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const count = (messages ?? []).filter((message: any) =>
    role === 'organizer'
      ? message.sender_role === 'vendor' && !message.read_by_organizer_at
      : message.sender_role === 'organizer' && !message.read_by_vendor_at
  ).length

  return NextResponse.json({ count })
}
