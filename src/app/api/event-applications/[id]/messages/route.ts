import { NextRequest, NextResponse } from 'next/server'
import { requireRouteSession } from '@/lib/auth'

async function getAccessibleApplication(supabase: any, applicationId: string, userId: string) {
  const { data, error } = await supabase
    .from('event_applications')
    .select('*')
    .eq('id', applicationId)
    .or(`vendor_user_id.eq.${userId},organizer_user_id.eq.${userId}`)
    .maybeSingle()

  return { data, error }
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireRouteSession(req)
  if (auth.response) return auth.response
  const { supabase, user, role } = auth.session

  const { data: application, error: applicationError } = await getAccessibleApplication(supabase as any, params.id, user.id)
  if (applicationError || !application) {
    return NextResponse.json({ error: '応募情報が見つかりません' }, { status: 404 })
  }

  const { data: messages, error } = await (supabase as any)
    .from('application_messages')
    .select('*')
    .eq('application_id', params.id)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (role === 'organizer') {
    await (supabase as any)
      .from('application_messages')
      .update({ read_by_organizer_at: new Date().toISOString() })
      .eq('application_id', params.id)
      .is('read_by_organizer_at', null)
      .eq('sender_role', 'vendor')
  } else {
    await (supabase as any)
      .from('application_messages')
      .update({ read_by_vendor_at: new Date().toISOString() })
      .eq('application_id', params.id)
      .is('read_by_vendor_at', null)
      .eq('sender_role', 'organizer')
  }

  return NextResponse.json({ data: messages ?? [] })
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireRouteSession(req)
    if (auth.response) return auth.response
    const { supabase, user, role } = auth.session

    const { data: application, error: applicationError } = await getAccessibleApplication(supabase as any, params.id, user.id)
    if (applicationError || !application) {
      return NextResponse.json({ error: '応募情報が見つかりません' }, { status: 404 })
    }

    const body = await req.json()
    const message = String(body.message ?? '').trim()

    if (!message) {
      return NextResponse.json({ error: 'メッセージを入力してください' }, { status: 400 })
    }

    const readTimestamp = new Date().toISOString()
    const { data, error } = await (supabase as any)
      .from('application_messages')
      .insert([
        {
          application_id: params.id,
          sender_user_id: user.id,
          sender_role: role,
          message,
          read_by_vendor_at: role === 'vendor' ? readTimestamp : null,
          read_by_organizer_at: role === 'organizer' ? readTimestamp : null,
        },
      ])
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await (supabase as any)
      .from('event_applications')
      .update({
        last_message_at: readTimestamp,
      })
      .eq('id', params.id)

    return NextResponse.json({ data })
  } catch (error) {
    console.error('[application-messages POST]', error)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
