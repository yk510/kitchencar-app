import Link from 'next/link'
import SignupProfileHydrator from '@/components/SignupProfileHydrator'
import { BRAND_NAME } from '@/lib/brand'
import { requireServerSession } from '@/lib/auth'
import { getSignupSourceLabel } from '@/lib/onboarding'

export const dynamic = 'force-dynamic'

export default async function OrganizerWelcomePage({
  searchParams,
}: {
  searchParams?: { from?: string }
}) {
  const { role } = await requireServerSession()

  if (role !== 'organizer') {
    return null
  }

  const sourceLabel = getSignupSourceLabel(searchParams?.from ?? null, 'organizer')

  return (
    <div className="space-y-6">
      <SignupProfileHydrator role="organizer" />

      <div className="soft-panel rounded-[32px] px-8 py-8">
        <div className="badge-soft badge-blue inline-block">{BRAND_NAME}</div>
        <h1 className="mt-4 text-3xl font-bold text-[var(--text-main)]">登録が完了しました</h1>
        <p className="mt-3 text-sm leading-7 text-[var(--text-sub)]">
          {sourceLabel} からの登録ありがとうございます。ここからは、主催者プロフィールと募集の土台を整えていきましょう。
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="soft-panel rounded-[28px] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">STEP 1</p>
          <h2 className="mt-3 text-lg font-semibold text-[var(--text-main)]">主催者設定を確認する</h2>
          <p className="mt-2 text-sm leading-7 text-[var(--text-sub)]">
            登録時に入れた情報を確認して、応募してもらいやすいプロフィールに整えます。
          </p>
          <Link
            href="/organizer/profile"
            className="mt-5 inline-flex rounded-full bg-[var(--accent-blue)] px-4 py-2 text-sm font-semibold text-white"
          >
            主催者設定へ
          </Link>
        </div>

        <div className="soft-panel rounded-[28px] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">STEP 2</p>
          <h2 className="mt-3 text-lg font-semibold text-[var(--text-main)]">最初の募集を作る</h2>
          <p className="mt-2 text-sm leading-7 text-[var(--text-sub)]">
            会場写真や募集条件を入れて、ベンダーに伝わる募集ページを作り始めます。
          </p>
          <Link
            href="/organizer/offers?guide=onboarding-organizer"
            className="mt-5 inline-flex rounded-full bg-[var(--accent-blue)] px-4 py-2 text-sm font-semibold text-white"
          >
            募集管理へ
          </Link>
        </div>

        <div className="soft-panel rounded-[28px] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">STEP 3</p>
          <h2 className="mt-3 text-lg font-semibold text-[var(--text-main)]">応募管理の導線を見る</h2>
          <p className="mt-2 text-sm leading-7 text-[var(--text-sub)]">
            応募が来たあとにどこでやり取りするか、先に導線だけ確認しておくと安心です。
          </p>
          <Link
            href="/organizer/applications"
            className="mt-5 inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-[var(--accent-blue)] ring-1 ring-[var(--line-soft)]"
          >
            応募管理を見る
          </Link>
        </div>
      </div>
    </div>
  )
}
