import VenueMapEmbed from '@/components/VenueMapEmbed'

type Badge = {
  label: string
  tone?: 'blue' | 'slate' | 'green'
}

type EventOfferPreviewCardProps = {
  title: string | null
  periodLabel: string
  venueName: string | null
  venueAddress?: string | null
  municipality?: string | null
  recruitmentCount: string | number
  feeLabel: string
  applicationDeadline?: string | null
  loadInStartTime?: string | null
  loadInEndTime?: string | null
  salesStartTime?: string | null
  salesEndTime?: string | null
  loadOutStartTime?: string | null
  loadOutEndTime?: string | null
  photoUrls?: string[] | null
  venueFeatures?: string | null
  recruitmentPurpose?: string | null
  requiredEquipment?: string | null
  notes?: string | null
  providedFacilities?: string[] | null
  badges?: Badge[]
  emptyPhotoText?: string
}

function badgeClassName(tone: Badge['tone']) {
  if (tone === 'green') return 'rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700'
  if (tone === 'slate') return 'rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700'
  return 'badge-soft badge-blue'
}

export default function EventOfferPreviewCard({
  title,
  periodLabel,
  venueName,
  venueAddress,
  municipality,
  recruitmentCount,
  feeLabel,
  applicationDeadline,
  loadInStartTime,
  loadInEndTime,
  salesStartTime,
  salesEndTime,
  loadOutStartTime,
  loadOutEndTime,
  photoUrls,
  venueFeatures,
  recruitmentPurpose,
  requiredEquipment,
  notes,
  providedFacilities,
  badges = [],
  emptyPhotoText = '写真を入れるとここに表示されます',
}: EventOfferPreviewCardProps) {
  return (
    <div className="rounded-3xl border border-[var(--line-soft)] bg-white p-5">
      {(photoUrls ?? []).length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {photoUrls!.slice(0, 4).map((url, index) => (
            <div key={`${url.slice(0, 20)}-${index}`} className="overflow-hidden rounded-2xl border border-[var(--line-soft)] bg-[#f8fafc]">
              <img src={url} alt={`プレビュー写真 ${index + 1}`} className="h-40 w-full object-cover" />
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl bg-[#f8fafc] px-4 py-8 text-center text-sm text-gray-400">{emptyPhotoText}</div>
      )}

      <div className="mt-4">
        {badges.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {badges.map((badge) => (
              <span key={`${badge.tone ?? 'blue'}-${badge.label}`} className={badgeClassName(badge.tone)}>
                {badge.label}
              </span>
            ))}
          </div>
        )}
        <h3 className="mt-3 text-xl font-semibold text-gray-800">{title || '募集名が入ります'}</h3>
        <p className="mt-2 text-sm text-gray-500">
          {periodLabel} / {venueName || '開催場所'}
        </p>
      </div>

      <div className="mt-4 grid gap-2 text-sm text-gray-600">
        <p>募集台数 {recruitmentCount || '1'} 台</p>
        <p>出店料 {feeLabel}</p>
        <p>募集締切 {applicationDeadline || '-'}</p>
      </div>

      <div className="mt-4 grid gap-2 text-sm text-gray-600 md:grid-cols-3">
        <p>搬入 {loadInStartTime || '-'} 〜 {loadInEndTime || '-'}</p>
        <p>販売 {salesStartTime || '-'} 〜 {salesEndTime || '-'}</p>
        <p>搬出 {loadOutStartTime || '-'} 〜 {loadOutEndTime || '-'}</p>
      </div>

      <div className="mt-4">
        <p className="text-sm font-medium text-gray-800">会場地図</p>
        <div className="mt-2">
          <VenueMapEmbed venueName={venueName} municipality={municipality} venueAddress={venueAddress} />
        </div>
      </div>

      <div className="mt-5 rounded-2xl bg-[#f8fafc] p-4">
        <p className="text-sm font-medium text-gray-800">イベント・会場の特徴</p>
        <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">{venueFeatures || 'ここに会場の雰囲気や来場者イメージが表示されます。'}</p>
      </div>

      <div className="mt-4 rounded-2xl bg-[#f8fafc] p-4">
        <p className="text-sm font-medium text-gray-800">募集背景・目的</p>
        <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">{recruitmentPurpose || 'なぜ募集するのか、どんな出店者を求めているかがここに表示されます。'}</p>
      </div>

      <div className="mt-4 rounded-2xl bg-[#f8fafc] p-4">
        <p className="text-sm font-medium text-gray-800">必要設備・条件</p>
        <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">{requiredEquipment || '必要設備や条件がここに表示されます。'}</p>
      </div>

      <div className="mt-4 rounded-2xl bg-[#f8fafc] p-4">
        <p className="text-sm font-medium text-gray-800">備考</p>
        <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">{notes || '補足事項がここに表示されます。'}</p>
      </div>

      <div className="mt-4">
        <p className="text-sm font-medium text-gray-800">提供設備</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(providedFacilities ?? []).length > 0 ? (
            providedFacilities!.map((facility) => (
              <span key={facility} className="rounded-full bg-[var(--accent-blue-soft)] px-3 py-1 text-xs text-[var(--accent-blue)]">
                {facility}
              </span>
            ))
          ) : (
            <span className="text-sm text-gray-400">未設定</span>
          )}
        </div>
      </div>
    </div>
  )
}
