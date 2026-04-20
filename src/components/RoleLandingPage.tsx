'use client'

import Link from 'next/link'
import { BRAND_CONCEPT, BRAND_NAME, BRAND_STAGE_LABEL } from '@/lib/brand'
import type { AppRole } from '@/lib/user-role'

const VENDOR_VALUES = [
  {
    title: 'AirレジCSVを入れるだけで深掘り分析',
    body: '場所別、イベント別、天候別まで見えるので、感覚頼みになりがちな営業判断を数字で振り返れます。',
  },
  {
    title: 'カレンダー画像から売上予測まで',
    body: '翌月の営業カレンダーを読み込んで、過去実績をもとに売上予測を立てられます。',
  },
  {
    title: '営業メモからAI週報を作成',
    body: '日々の気づきと売上データをまとめて、週次のふり返りとネクストアクションに変えます。',
  },
  {
    title: '新しい出店先との出会いが増える',
    body: '募集一覧からイベントを探して、そのまま主催者へ質問や応募、やり取りまで進められます。',
  },
] as const

const ORGANIZER_VALUES = [
  {
    title: '出店事業者の管理を一元化',
    body: '募集作成、応募管理、メッセージ、出店決定までをプラットフォーム上でまとめて進められます。',
  },
  {
    title: '募集の魅力を伝えて応募を集める',
    body: '会場写真や背景・目的まで整理して公開することで、イベントに合うキッチンカー事業者が見つかりやすくなります。',
  },
  {
    title: 'やり取りの履歴が散らばらない',
    body: '質問、応募、出店決定後の連絡まで、案件ごとにまとまった状態で確認できます。',
  },
  {
    title: '将来的なスカウト機能にもつながる',
    body: '今後は条件に合う事業者を見つけて直接スカウトできるように広げていく前提で設計しています。',
  },
] as const

export default function RoleLandingPage({ role }: { role: AppRole }) {
  const isVendor = role === 'vendor'
  const values = isVendor ? VENDOR_VALUES : ORGANIZER_VALUES
  const signupHref = isVendor ? '/signup/vendor?from=vendor-lp' : '/signup/organizer?from=organizer-lp'

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <section className="soft-panel overflow-hidden rounded-[36px] border border-white/70 px-7 py-8 lg:px-10 lg:py-10">
        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="badge-soft badge-blue">{BRAND_NAME}</span>
              <span className="rounded-full bg-[#eef4ff] px-3 py-1 text-[11px] font-semibold tracking-[0.14em] text-[var(--accent-blue)]">
                {BRAND_STAGE_LABEL}
              </span>
              <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold tracking-[0.14em] text-orange-700 ring-1 ring-[var(--line-soft)]">
                {isVendor ? 'VENDOR EDITION' : 'ORGANIZER EDITION'}
              </span>
            </div>
            <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.24em] text-orange-700">
              {isVendor ? 'FOOD TRUCK BUSINESS OS' : 'EVENT ORGANIZER WORKSPACE'}
            </p>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-[var(--text-main)] lg:text-5xl">
              {isVendor ? '売上入力で終わらせない。' : '募集と応募対応を、ひとつに。'}
            </h1>
            <p className="mt-4 text-lg font-semibold text-[var(--accent-blue)]">{BRAND_CONCEPT}</p>
            <p className="mt-4 max-w-2xl text-sm leading-8 text-[var(--text-sub)]">
              {isVendor
                ? 'クリダス!! は、キッチンカー事業者が日々の営業を「ただ回す」状態から、「数字を見て改善する」状態へ進めるための業務OSです。'
                : 'クリダス!! は、イベント主催者が煩雑になりやすい募集・応募・連絡の流れを整理し、出店者管理を前に進めるための運営OSです。'}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={signupHref}
                className="soft-button rounded-full bg-[var(--accent-blue)] px-6 py-3 text-sm font-semibold text-white hover:bg-[#2f59d9]"
              >
                {isVendor ? 'キッチンカー事業者として登録する' : 'イベント主催者として登録する'}
              </Link>
              <Link
                href={`/login?role=${isVendor ? 'vendor' : 'organizer'}&from=${isVendor ? 'vendor-lp' : 'organizer-lp'}`}
                className="soft-button rounded-full bg-white px-6 py-3 text-sm font-semibold text-[var(--accent-blue)] ring-1 ring-[var(--line-soft)]"
              >
                すでにアカウントを持っている
              </Link>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {values.map((item, index) => (
              <article key={item.title} className="rounded-3xl border border-[var(--line-soft)] bg-white/90 p-5 shadow-[0_18px_50px_rgba(29,53,87,0.06)]">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--accent-blue-soft)] text-sm font-bold text-[var(--accent-blue)]">
                  {index + 1}
                </div>
                <h2 className="mt-4 text-base font-bold text-[var(--text-main)]">{item.title}</h2>
                <p className="mt-2 text-sm leading-7 text-[var(--text-sub)]">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="soft-panel rounded-[32px] p-7">
          <div className="badge-soft badge-blue inline-block">登録は最短3分</div>
          <h2 className="mt-4 text-2xl font-bold text-[var(--text-main)]">
            {isVendor ? 'まずは営業の土台を作る情報だけで始められます。' : 'まずは募集に必要な基本情報から始められます。'}
          </h2>
          <div className="mt-6 space-y-4">
            {(isVendor
              ? [
                  ['1', 'アカウント作成', 'メール、パスワード、事業者名を登録します。'],
                  ['2', 'プロフィール入力', '主なメニューやジャンル、紹介文を整えます。'],
                  ['3', '分析や営業予測を使い始める', 'CSV取込や営業予定入力へそのまま進めます。'],
                ]
              : [
                  ['1', 'アカウント作成', 'メール、パスワード、主催者名を登録します。'],
                  ['2', '主催者プロフィール入力', '信頼感が伝わる主催者情報を整えます。'],
                  ['3', '募集作成を始める', '会場写真や出店条件をまとめて募集公開へ進みます。'],
                ]).map(([step, title, body]) => (
              <div key={step} className="flex gap-4 rounded-3xl border border-[var(--line-soft)] bg-white/80 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-blue)] text-sm font-bold text-white">
                  {step}
                </div>
                <div>
                  <p className="font-semibold text-[var(--text-main)]">{title}</p>
                  <p className="mt-1 text-sm text-[var(--text-sub)]">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="soft-panel rounded-[32px] p-7">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="badge-soft badge-blue inline-block">提供価値</div>
              <h2 className="mt-4 text-2xl font-bold text-[var(--text-main)]">
                {isVendor ? '営業データを、次の一手に変える。' : '出店者管理を、案件単位で見える化する。'}
              </h2>
            </div>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {(isVendor
              ? [
                  ['場所別・イベント別分析', 'どこで強いか、何が伸びるかを比較できます。'],
                  ['天候・曜日の傾向把握', '再現性のある営業判断に近づけます。'],
                  ['AI週報で振り返り', 'メモと数字を週次で整理して、改善の方向を見つけられます。'],
                  ['新しい出店先との接点', '募集を見つけて、そのまま主催者とやり取りできます。'],
                ]
              : [
                  ['応募の一元管理', '誰が応募しているか、どこまで返答したかをまとめて見られます。'],
                  ['主催者情報の整理', 'プロフィールを整えて、応募の質を高められます。'],
                  ['募集ページの作成', '写真や背景まで含めて魅力を伝えられます。'],
                  ['今後のスカウト基盤', '将来の事業者検索・スカウトにつながるデータを蓄積できます。'],
                ]).map(([title, body]) => (
              <div key={title} className="rounded-3xl bg-[#f8fbff] p-5 ring-1 ring-[var(--line-soft)]">
                <p className="font-semibold text-[var(--text-main)]">{title}</p>
                <p className="mt-2 text-sm leading-7 text-[var(--text-sub)]">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
