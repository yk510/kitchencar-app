import { NextRequest, NextResponse } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { contactReleaseMessage, statusUpdateMessage } from '@/lib/applicationMessages'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireRouteSession(req)
    if (auth.response) return auth.response
    const { supabase, user, role } = auth.session

    const id = params.id
    const body = await req.json()
    const releaseContact = body.release_contact === true
    const status =
      body.status === 'accepted' || body.status === 'rejected' || body.status === 'under_review' || body.status === 'pending'
        ? body.status
        : null

    if (!status && !releaseContact) {
      return NextResponse.json({ error: '更新内容が不正です' }, { status: 400 })
    }

    const { data: application, error: applicationError } = await (supabase as any)
      .from('event_applications')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (applicationError || !application) {
      return NextResponse.json({ error: '応募情報が見つかりません' }, { status: 404 })
    }

    if (role !== 'organizer' || application.organizer_user_id !== user.id) {
      return NextResponse.json({ error: '更新権限がありません' }, { status: 403 })
    }

    const updateTimestamp = new Date().toISOString()

    if (releaseContact) {
      if (application.status !== 'accepted') {
        return NextResponse.json({ error: '出店決定後に連絡先を公開できます' }, { status: 400 })
      }

      if (application.contact_released_at) {
        return NextResponse.json({ error: '連絡先情報はすでに公開済みです' }, { status: 400 })
      }

      const { data: organizerProfile, error: organizerProfileError } = await (supabase as any)
        .from('organizer_profiles')
        .select('contact_name, contact_email, phone')
        .eq('user_id', user.id)
        .maybeSingle()

      if (organizerProfileError || !organizerProfile) {
        return NextResponse.json({ error: '主催者設定の取得に失敗しました' }, { status: 500 })
      }

      if (!organizerProfile.contact_email && !organizerProfile.phone) {
        return NextResponse.json({ error: '公開できる連絡先情報がありません' }, { status: 400 })
      }

      const releaseMessage = contactReleaseMessage({
        contactName: organizerProfile.contact_name ?? null,
        contactEmail: organizerProfile.contact_email ?? null,
        phone: organizerProfile.phone ?? null,
      })

      const { error: updateError } = await (supabase as any)
        .from('event_applications')
        .update({
          contact_released_at: updateTimestamp,
          last_message_at: updateTimestamp,
        })
        .eq('id', id)

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 500 })
      }

      const messageInsert = await (supabase as any)
        .from('application_messages')
        .insert([
          {
            application_id: id,
            sender_user_id: user.id,
            sender_role: 'organizer',
            message: releaseMessage,
            read_by_vendor_at: null,
            read_by_organizer_at: updateTimestamp,
          },
        ])

      if (messageInsert.error) {
        return NextResponse.json({ error: messageInsert.error.message }, { status: 500 })
      }

      return NextResponse.json({ data: { ...application, contact_released_at: updateTimestamp } })
    }

    const { data, error } = await (supabase as any)
      .from('event_applications')
      .update({
        status,
        last_message_at: updateTimestamp,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (status === 'accepted' || status === 'rejected') {
      const messageInsert = await (supabase as any)
        .from('application_messages')
        .insert([
          {
            application_id: id,
            sender_user_id: user.id,
            sender_role: 'organizer',
            message: statusUpdateMessage(status),
            read_by_vendor_at: null,
            read_by_organizer_at: updateTimestamp,
          },
        ])

      if (messageInsert.error) {
        return NextResponse.json({ error: messageInsert.error.message }, { status: 500 })
      }
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('[event-applications PATCH]', error)
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
