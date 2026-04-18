type VenueMapEmbedProps = {
  venueName?: string | null
  municipality?: string | null
  venueAddress?: string | null
  className?: string
}

export function buildVenueMapQuery({
  venueName,
  municipality,
  venueAddress,
}: VenueMapEmbedProps) {
  return [venueName, municipality, venueAddress].filter((value) => typeof value === 'string' && value.trim().length > 0).join(' ')
}

export default function VenueMapEmbed({
  venueName,
  municipality,
  venueAddress,
  className = '',
}: VenueMapEmbedProps) {
  const query = buildVenueMapQuery({ venueName, municipality, venueAddress })

  if (!query) {
    return (
      <div className={`rounded-2xl bg-[#f8fafc] px-4 py-8 text-center text-sm text-gray-400 ${className}`}>
        住所を入れると地図がここに表示されます
      </div>
    )
  }

  const encodedQuery = encodeURIComponent(query)
  const src = `https://maps.google.com/maps?hl=ja&q=${encodedQuery}&z=15&ie=UTF8&iwloc=B&output=embed`
  const externalMapUrl = `https://www.google.com/maps/search/?api=1&query=${encodedQuery}`

  return (
    <div className={`overflow-hidden rounded-2xl border border-[var(--line-soft)] bg-[#f8fafc] ${className}`}>
      <iframe
        title="会場地図"
        src={src}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        className="h-64 w-full border-0"
      />
      <div className="flex justify-end border-t border-[var(--line-soft)] bg-white px-3 py-2">
        <a
          href={externalMapUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs font-semibold text-[var(--accent-blue)]"
        >
          Google マップで開く
        </a>
      </div>
    </div>
  )
}
