type SocialLinkButtonsProps = {
  instagramUrl?: string | null
  xUrl?: string | null
  emptyLabel?: string
}

export default function SocialLinkButtons({
  instagramUrl,
  xUrl,
  emptyLabel = '未設定',
}: SocialLinkButtonsProps) {
  if (!instagramUrl && !xUrl) {
    return <p className="text-sm text-gray-500">{emptyLabel}</p>
  }

  return (
    <div className="flex flex-wrap gap-3">
      {instagramUrl ? (
        <a
          href={instagramUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-[var(--accent-blue)] ring-1 ring-[var(--line-soft)]"
        >
          Instagramを見る
        </a>
      ) : null}
      {xUrl ? (
        <a
          href={xUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-[var(--accent-blue)] ring-1 ring-[var(--line-soft)]"
        >
          Xを見る
        </a>
      ) : null}
    </div>
  )
}
