import Link from 'next/link'
import { BRAND_NAME } from '@/lib/brand'
import { requireServerSession } from '@/lib/auth'
import { getSignupSourceLabel } from '@/lib/onboarding'

export const dynamic = 'force-dynamic'

export default async function VendorWelcomePage({
  searchParams,
}: {
  searchParams?: { from?: string; offer?: string }
}) {
  const { role } = await requireServerSession()

  if (role !== 'vendor') {
    return null
  }

  const sourceLabel = getSignupSourceLabel(searchParams?.from ?? null, 'vendor')
  const returnOfferId = searchParams?.offer ?? null

  return (
    <div className="space-y-6">
      <div className="soft-panel rounded-[32px] px-8 py-8">
        <div className="badge-soft badge-blue inline-block">{BRAND_NAME}</div>
        <h1 className="mt-4 text-3xl font-bold text-[var(--text-main)]">登録が完了しました</h1>
        <p className="mt-3 text-sm leading-7 text-[var(--text-sub)]">
          {sourceLabel} からの登録ありがとうございます。ここからは、営業データを活用できる状態を少しずつ整えていきましょう。
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {returnOfferId && (
          <div className="soft-panel rounded-[28px] border border-[var(--accent-blue)]/20 bg-[var(--accent-blue-soft)] p-6 lg:col-span-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-blue)]">応募導線</p>
            <h2 className="mt-3 text-lg font-semibold text-[var(--text-main)]">気になっていた募集へ戻れます</h2>
            <p className="mt-2 text-sm leading-7 text-[var(--text-sub)]">
              登録が完了しました。外部公開ページで見ていた募集詳細へ戻り、応募メッセージを送信できます。
            </p>
            <Link
              href={`/vendor/offers/${returnOfferId}`}
              className="mt-5 inline-flex rounded-full bg-[var(--accent-blue)] px-4 py-2 text-sm font-semibold text-white"
            >
              募集詳細へ戻って応募する
            </Link>
          </div>
        )}

        <div className="soft-panel rounded-[28px] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">STEP 1</p>
          <h2 className="mt-3 text-lg font-semibold text-[var(--text-main)]">事業者設定を確認する</h2>
          <p className="mt-2 text-sm leading-7 text-[var(--text-sub)]">
            登録時に入れたプロフィールを確認して、主なメニューや紹介文を整えます。
          </p>
          <Link
            href="/vendor/profile"
            className="mt-5 inline-flex rounded-full bg-[var(--accent-blue)] px-4 py-2 text-sm font-semibold text-white"
          >
            事業者設定へ
          </Link>
        </div>

        <div className="soft-panel rounded-[28px] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">STEP 2</p>
          <h2 className="mt-3 text-lg font-semibold text-[var(--text-main)]">売上データを取り込む</h2>
          <p className="mt-2 text-sm leading-7 text-[var(--text-sub)]">
            Airレジの取引履歴CSVを入れると、分析や営業ふり返りをすぐ始められます。
          </p>
          <Link
            href="/upload?guide=onboarding-vendor"
            className="mt-5 inline-flex rounded-full bg-[var(--accent-blue)] px-4 py-2 text-sm font-semibold text-white"
          >
            売上データ取込へ
          </Link>
        </div>

        <div className="soft-panel rounded-[28px] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-orange-700">STEP 3</p>
          <h2 className="mt-3 text-lg font-semibold text-[var(--text-main)]">募集を探してみる</h2>
          <p className="mt-2 text-sm leading-7 text-[var(--text-sub)]">
            出店先を探したいときは、公開中の募集を見て、そのまま質問や応募まで進められます。
          </p>
          <Link
            href="/vendor/offers"
            className="mt-5 inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-[var(--accent-blue)] ring-1 ring-[var(--line-soft)]"
          >
            募集を探す
          </Link>
        </div>
      </div>
    </div>
  )
}
