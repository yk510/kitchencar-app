export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { getServerSession } from '@/lib/auth'
import { redirect } from 'next/navigation'

async function getOrganizerDashboardData(supabase: any, userId: string) {
  const [{ data: profile }, { data: offers }, { data: applications }] = await Promise.all([
    (supabase as any)
      .from('organizer_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle(),
    (supabase as any)
      .from('event_offers')
      .select('*')
      .eq('user_id', userId)
      .order('event_date', { ascending: true }),
    (supabase as any)
      .from('event_applications')
      .select('id')
      .eq('organizer_user_id', userId),
  ])

  const offerList = (offers ?? []) as any[]
  const openOffers = offerList.filter((offer) => offer.status === 'open')
  const draftOffers = offerList.filter((offer) => offer.status === 'draft')
  const nextOffer =
    offerList.find((offer) => offer.event_date >= new Date().toISOString().slice(0, 10)) ?? offerList[0] ?? null

  const applicationIds = (applications ?? []).map((application: any) => application.id)
  const { data: messages } =
    applicationIds.length > 0
      ? await (supabase as any)
          .from('application_messages')
          .select('id, sender_role, read_by_organizer_at')
          .in('application_id', applicationIds)
      : { data: [] }

  return {
    profile: profile as any,
    totalOffers: offerList.length,
    openOffers: openOffers.length,
    draftOffers: draftOffers.length,
    totalApplications: (applications ?? []).length,
    unreadApplications: (messages ?? []).filter((message: any) => message.sender_role === 'vendor' && !message.read_by_organizer_at).length,
    nextOffer,
  }
}

export default async function OrganizerDashboardPage() {
  const session = await getServerSession()
  if (!session) {
    redirect('/lp')
  }

  const { supabase, user, role } = session
  const data = await getOrganizerDashboardData(supabase, user.id)

  if (role !== 'organizer') {
    return (
      <div className="soft-panel p-8 text-center">
        <p className="text-sm text-gray-500">この画面は主催者向けです。</p>
        <Link href="/" className="mt-4 inline-flex rounded-full bg-[var(--accent-blue)] px-4 py-2 text-sm font-semibold text-white">
          ホームへ戻る
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="badge-blue badge-soft inline-block mb-3">主催者ホーム</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          {data.profile?.organizer_name || '主催者'}の運営ボード
        </h1>
        <p className="text-sm text-gray-500">
          募集の作成、公開状況の確認、今後の応募管理の入口をまとめています。
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="kpi-card p-6">
          <p className="text-sm text-sub">作成済み募集</p>
          <p className="mt-2 text-3xl font-bold text-blue-700">{data.totalOffers} 件</p>
        </div>
        <div className="kpi-card p-6">
          <p className="text-sm text-sub">募集中</p>
          <p className="mt-2 text-3xl font-bold text-green-700">{data.openOffers} 件</p>
        </div>
        <div className="kpi-card p-6">
          <p className="text-sm text-sub">下書き</p>
          <p className="mt-2 text-3xl font-bold text-orange-600">{data.draftOffers} 件</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="kpi-card p-6">
          <p className="text-sm text-sub">届いている応募</p>
          <p className="mt-2 text-3xl font-bold text-slate-700">{data.totalApplications} 件</p>
        </div>
        <div className="kpi-card p-6">
          <p className="text-sm text-sub">未読メッセージ</p>
          <p className="mt-2 text-3xl font-bold text-red-600">{data.unreadApplications} 件</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.95fr]">
        <div className="soft-panel p-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">次にやること</h2>
              <p className="mt-1 text-sm text-gray-500">主催者向けの基本導線をここから進められます。</p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <Link href="/organizer/profile" className="block rounded-2xl border border-[var(--line-soft)] bg-white px-4 py-4 hover:bg-[var(--accent-blue-soft)]">
              <p className="font-medium text-gray-800">主催者設定を確認する</p>
              <p className="mt-1 text-sm text-gray-500">団体名や連絡先を整えて、募集画面で使いやすくします。</p>
            </Link>
            <Link href="/organizer/offers" className="block rounded-2xl border border-[var(--line-soft)] bg-white px-4 py-4 hover:bg-[var(--accent-blue-soft)]">
              <p className="font-medium text-gray-800">新しい募集を作る</p>
              <p className="mt-1 text-sm text-gray-500">開催日、場所、募集台数、出店料などを登録します。</p>
            </Link>
            <Link href="/organizer/applications" className="block rounded-2xl border border-[var(--line-soft)] bg-white px-4 py-4 hover:bg-[var(--accent-blue-soft)]">
              <p className="font-medium text-gray-800">応募を確認して返答する</p>
              <p className="mt-1 text-sm text-gray-500">どの事業者から応募が来たか確認して、チャットで返答できます。</p>
            </Link>
          </div>
        </div>

        <div className="soft-panel p-6">
          <h2 className="text-lg font-semibold text-gray-800">直近の募集</h2>
          {data.nextOffer ? (
            <div className="mt-4 rounded-2xl border border-[var(--line-soft)] bg-white p-5">
              <span className="badge-soft badge-blue">
                {data.nextOffer.status === 'open' ? '募集中' : data.nextOffer.status === 'closed' ? '募集終了' : '下書き'}
              </span>
              <p className="mt-3 text-lg font-semibold text-gray-800">{data.nextOffer.title}</p>
              <p className="mt-2 text-sm text-gray-500">
                {data.nextOffer.event_end_date && data.nextOffer.event_end_date !== data.nextOffer.event_date
                  ? `${data.nextOffer.event_date} 〜 ${data.nextOffer.event_end_date}`
                  : data.nextOffer.event_date}{' '}
                / {data.nextOffer.venue_name}
              </p>
              <p className="mt-2 text-sm text-gray-600">
                募集台数 {data.nextOffer.recruitment_count} 台 / 出店料 {data.nextOffer.stall_fee != null ? `${Number(data.nextOffer.stall_fee).toLocaleString()} 円` : '-'}
              </p>
              <p className="mt-2 text-sm text-gray-600">
                搬入 {data.nextOffer.load_in_start_time || '-'} 〜 {data.nextOffer.load_in_end_time || '-'} / 販売 {data.nextOffer.sales_start_time || '-'} 〜 {data.nextOffer.sales_end_time || '-'}
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-gray-500">まだ募集は作成されていません。</p>
          )}
        </div>
      </div>
    </div>
  )
}
