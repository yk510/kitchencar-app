import Link from 'next/link'
import { notFound } from 'next/navigation'
import EventOfferPreviewCard from '@/components/EventOfferPreviewCard'
import PublicProfileCard from '@/components/PublicProfileCard'
import { BRAND_CONCEPT, BRAND_NAME, BRAND_STAGE_LABEL } from '@/lib/brand'
import { createServerSupabaseClient } from '@/lib/supabase'
import type { OrganizerPublicProfile } from '@/types/marketplace'

export const dynamic = 'force-dynamic'

function formatPeriod(start: string, end?: string | null) {
  return end && end !== start ? `${start} 〜 ${end}` : start
}

function formatFeeLabel(input: {
  fee_type: 'fixed' | 'revenue_share' | 'fixed_plus_revenue_share' | 'free'
  stall_fee: number | null
  revenue_share_rate: number | null
}) {
  if (input.fee_type === 'free') return '無料'
  if (input.fee_type === 'revenue_share') return `${input.revenue_share_rate ?? '-'}%（売上歩合）`
  if (input.fee_type === 'fixed_plus_revenue_share') {
    return `${input.stall_fee != null ? `${Number(input.stall_fee).toLocaleString()}円` : '-'}（固定） + ${input.revenue_share_rate ?? '-'}%（売上歩合）`
  }
  return input.stall_fee != null ? `${Number(input.stall_fee).toLocaleString()}円（固定）` : '-'
}

export default async function PublicOfferPage({ params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient()

  const { data: offer, error } = await (supabase as any)
    .from('event_offers')
    .select('*')
    .eq('id', params.id)
    .eq('status', 'open')
    .eq('is_public', true)
    .maybeSingle()

  if (error || !offer) {
    notFound()
  }

  const { data: organizerProfile } = await (supabase as any).rpc('get_organizer_public_profile', {
    target_user_id: offer.user_id,
  })
  const organizer = (Array.isArray(organizerProfile) ? organizerProfile[0] : organizerProfile) as
    | OrganizerPublicProfile
    | null

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 lg:px-6">
      <section className="soft-panel rounded-[36px] px-7 py-8 lg:px-10">
        <div className="flex flex-wrap items-center gap-2">
          <span className="badge-soft badge-blue">{BRAND_NAME}</span>
          <span className="rounded-full bg-[#eef4ff] px-3 py-1 text-[11px] font-semibold tracking-[0.12em] text-[var(--accent-blue)]">
            {BRAND_STAGE_LABEL}
          </span>
          <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold tracking-[0.12em] text-orange-700 ring-1 ring-[var(--line-soft)]">
            PUBLIC OFFER
          </span>
        </div>
        <h1 className="mt-5 text-3xl font-black tracking-tight text-[var(--text-main)] lg:text-4xl">
          {offer.title}
        </h1>
        <p className="mt-3 text-sm font-semibold text-[var(--accent-blue)]">{BRAND_CONCEPT}</p>
        <p className="mt-4 max-w-3xl text-sm leading-8 text-[var(--text-sub)]">
          このページは、イベント主催者が外部公開しているキッチンカー募集ページです。
          興味がある場合は、クリダス!! に登録して主催者へ質問・応募できます。
        </p>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <EventOfferPreviewCard
            badges={[
              { label: '外部公開中', tone: 'green' },
              { label: organizer?.organizer_name ?? '主催者', tone: 'blue' },
            ]}
            title={offer.title}
            periodLabel={formatPeriod(offer.event_date, offer.event_end_date)}
            venueName={offer.venue_name}
            venueAddress={offer.venue_address}
            municipality={offer.municipality}
            recruitmentCount={offer.recruitment_count}
            feeLabel={formatFeeLabel(offer)}
            applicationDeadline={offer.application_deadline}
            loadInStartTime={offer.load_in_start_time}
            loadInEndTime={offer.load_in_end_time}
            salesStartTime={offer.sales_start_time}
            salesEndTime={offer.sales_end_time}
            loadOutStartTime={offer.load_out_start_time}
            loadOutEndTime={offer.load_out_end_time}
            photoUrls={offer.photo_urls}
            venueFeatures={offer.venue_features}
            recruitmentPurpose={offer.recruitment_purpose}
            requiredEquipment={offer.required_equipment}
            notes={offer.notes}
            providedFacilities={offer.provided_facilities}
          />
        </div>

        <aside className="space-y-6">
          <section className="soft-panel rounded-[32px] p-6">
            <div className="badge-soft badge-blue inline-block">応募するには登録が必要です</div>
            <h2 className="mt-4 text-xl font-bold text-[var(--text-main)]">興味があれば、まずはかんたん登録へ</h2>
            <p className="mt-3 text-sm leading-7 text-[var(--text-sub)]">
              事業者名、連絡先、ジャンルなど最低限の情報を登録すると、この募集の詳細ページへ戻って応募メッセージを送れます。
            </p>
            <Link
              href={`/signup/vendor?from=external-offer&offer=${encodeURIComponent(offer.id)}`}
              className="mt-5 inline-flex w-full justify-center rounded-full bg-[var(--accent-blue)] px-5 py-3 text-sm font-semibold text-white"
            >
              登録してこの募集に応募する
            </Link>
            <Link
              href={`/login?role=vendor`}
              className="mt-3 inline-flex w-full justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-[var(--accent-blue)] ring-1 ring-[var(--line-soft)]"
            >
              すでに登録済みの方はログイン
            </Link>
          </section>

          {organizer && (
            <PublicProfileCard
              title="主催者情報"
              nameLabel="団体名"
              name={organizer.organizer_name}
              contactLabel="担当者"
              contactName={organizer.contact_name}
              logoImageUrl={organizer.logo_image_url}
              instagramUrl={organizer.instagram_url}
              xUrl={organizer.x_url}
              description={organizer.description}
            />
          )}
        </aside>
      </div>
    </div>
  )
}
