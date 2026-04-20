import SocialLinkButtons from '@/components/SocialLinkButtons'

type PublicProfileCardProps = {
  title: string
  nameLabel: string
  name: string
  contactLabel: string
  contactName?: string | null
  genreLabel?: string | null
  logoImageUrl?: string | null
  mainMenu?: string | null
  instagramUrl?: string | null
  xUrl?: string | null
  description?: string | null
}

export default function PublicProfileCard({
  title,
  nameLabel,
  name,
  contactLabel,
  contactName,
  genreLabel,
  logoImageUrl,
  mainMenu,
  instagramUrl,
  xUrl,
  description,
}: PublicProfileCardProps) {
  return (
    <div className="soft-panel p-6">
      <h2 className="text-lg font-semibold text-gray-800">{title}</h2>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-3xl border border-[var(--line-soft)] bg-[#f8fafc]">
          {logoImageUrl ? (
            <img src={logoImageUrl} alt={`${title}ロゴ`} className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs text-gray-400">未設定</span>
          )}
        </div>
        <div>
          <h3 className="text-xl font-semibold text-gray-800">{name}</h3>
          <p className="mt-1 text-sm text-gray-500">
            {contactLabel} {contactName || '-'}
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <div className="space-y-2 text-sm text-gray-600">
          <p>
            {nameLabel} {name}
          </p>
          <p>
            {contactLabel} {contactName || '-'}
          </p>
          {genreLabel ? <p>ジャンル {genreLabel}</p> : null}
        </div>

        {mainMenu != null ? (
          <div className="rounded-2xl bg-[#f8fafc] p-4">
            <p className="text-sm font-semibold text-gray-800">主なメニュー</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-gray-600">{mainMenu || '-'}</p>
          </div>
        ) : null}

        <div className="rounded-2xl bg-[#f8fafc] p-4">
          <p className="text-sm font-semibold text-gray-800">SNS・外部情報</p>
          <div className="mt-3">
            <SocialLinkButtons instagramUrl={instagramUrl} xUrl={xUrl} />
          </div>
        </div>

        {description ? (
          <div className="rounded-2xl bg-[#f8fafc] p-5">
            <p className="text-sm font-semibold text-gray-800">紹介文</p>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-700">{description}</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
