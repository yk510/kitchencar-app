'use client'

import Link from 'next/link'
import type { CSSProperties } from 'react'
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

const CARD_ACCENTS = [
  { border: '#1a57b5', bg: 'var(--accent-blue-soft)', text: '#1a57b5' },
  { border: '#39895a', bg: 'var(--accent-green-soft)', text: '#39895a' },
  { border: '#c46726', bg: 'var(--accent-orange-soft)', text: '#c46726' },
  { border: '#4240c4', bg: 'var(--accent-indigo-soft)', text: '#4240c4' },
] as const

export default function RoleLandingPage({ role }: { role: AppRole }) {
  const isVendor = role === 'vendor'
  const values = isVendor ? VENDOR_VALUES : ORGANIZER_VALUES
  const signupHref = isVendor ? '/signup/vendor?from=vendor-lp' : '/signup/organizer?from=organizer-lp'
  const heroStyle = isVendor
    ? ({
        '--hero-tint-a': 'rgba(255, 236, 210, 0.75)',
        '--hero-tint-b': 'rgba(225, 239, 255, 0.5)',
      } as CSSProperties)
    : ({
        '--hero-tint-a': 'rgba(220, 232, 255, 0.8)',
        '--hero-tint-b': 'rgba(237, 237, 254, 0.6)',
      } as CSSProperties)
  const steps = isVendor
    ? [
        ['1', 'アカウント作成', 'メール、パスワード、事業者名を登録します。'],
        ['2', 'プロフィール入力', '主なメニューやジャンル、紹介文を整えます。'],
        ['3', '分析や営業予測を使い始める', 'CSV取込や営業予定入力へそのまま進めます。'],
      ]
    : [
        ['1', 'アカウント作成', 'メール、パスワード、主催者名を登録します。'],
        ['2', '主催者プロフィール入力', '信頼感が伝わる主催者情報を整えます。'],
        ['3', '募集作成を始める', '会場写真や出店条件をまとめて募集公開へ進みます。'],
      ]

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="hero-panel relative px-7 py-9 lg:px-10 lg:py-12" style={heroStyle}>
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-bl-full opacity-30"
          style={{
            background: isVendor
              ? 'radial-gradient(circle, rgba(196,103,38,0.18) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(66,64,196,0.15) 0%, transparent 70%)',
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-0 h-40 w-40 rounded-tr-full opacity-20"
          style={{
            background: isVendor
              ? 'radial-gradient(circle, rgba(196,103,38,0.25) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(26,87,181,0.2) 0%, transparent 70%)',
          }}
        />

        <div className="relative grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="badge-soft badge-blue">{BRAND_NAME}</span>
              <span className="rounded-full bg-[var(--accent-blue-soft)] px-3 py-1 text-[11px] font-semibold tracking-[0.14em] text-[var(--accent-blue)]">
                {BRAND_STAGE_LABEL}
              </span>
              <span
                className="rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.14em] ring-1 ring-[var(--line-soft)]"
                style={{
                  background: isVendor ? 'var(--accent-orange-soft)' : 'var(--accent-indigo-soft)',
                  color: isVendor ? 'var(--accent-orange)' : 'var(--accent-indigo)',
                }}
              >
                {isVendor ? 'VENDOR EDITION' : 'ORGANIZER EDITION'}
              </span>
            </div>
            <p
              className="mt-5 text-[11px] font-bold uppercase tracking-[0.26em]"
              style={{ color: isVendor ? 'var(--accent-orange)' : 'var(--accent-indigo)' }}
            >
              {isVendor ? 'FOOD TRUCK BUSINESS OS' : 'EVENT ORGANIZER WORKSPACE'}
            </p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-[var(--text-main)] lg:text-5xl">
              {isVendor ? '売上入力で終わらせない。' : '募集と応募対応を、ひとつに。'}
            </h1>
            <p className="mt-3 text-base font-semibold text-[var(--accent-blue)]">{BRAND_CONCEPT}</p>
            <p className="mt-3 max-w-2xl text-sm leading-8 text-[var(--text-sub)]">
              {isVendor
                ? 'クリダス!! は、キッチンカー事業者が日々の営業を「ただ回す」状態から、「数字を見て改善する」状態へ進めるための業務OSです。'
                : 'クリダス!! は、イベント主催者が煩雑になりやすい募集・応募・連絡の流れを整理し、出店者管理を前に進めるための運営OSです。'}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={signupHref}
                className="soft-button inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:shadow-lg hover:brightness-110"
                style={{
                  background: isVendor
                    ? 'linear-gradient(135deg, #1a57b5 0%, #2264cc 100%)'
                    : 'linear-gradient(135deg, #4240c4 0%, #5451d6 100%)',
                }}
              >
                {isVendor ? 'キッチンカー事業者として登録する' : 'イベント主催者として登録する'}
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                  <path d="M3 7h8M7 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
              <Link
                href={`/login?role=${isVendor ? 'vendor' : 'organizer'}&from=${isVendor ? 'vendor-lp' : 'organizer-lp'}`}
                className="soft-button inline-flex items-center px-6 py-3 text-sm font-semibold text-[var(--accent-blue)] ring-1 ring-[var(--line-mid)] transition-all hover:ring-[var(--accent-blue)]"
                style={{ background: 'rgba(255,255,255,0.85)' }}
              >
                すでにアカウントを持っている
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {values.map((item, index) => {
              const accent = CARD_ACCENTS[index % CARD_ACCENTS.length]
              return (
                <article
                  key={item.title}
                  className="rounded-2xl border border-[var(--line-soft)] bg-white/90 p-5 shadow-[0_2px_12px_rgba(16,32,58,0.06)]"
                  style={{ borderLeft: `3px solid ${accent.border}` }}
                >
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold"
                    style={{ background: accent.bg, color: accent.text }}
                  >
                    {index + 1}
                  </div>
                  <h2 className="mt-3 text-sm font-bold leading-snug text-[var(--text-main)]">{item.title}</h2>
                  <p className="mt-2 text-xs leading-6 text-[var(--text-sub)]">{item.body}</p>
                </article>
              )
            })}
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="soft-panel rounded-[28px] p-7">
          <div className="badge-soft badge-blue inline-block">登録は最短3分</div>
          <h2 className="mt-4 text-xl font-bold text-[var(--text-main)]">
            {isVendor ? 'まずは営業の土台を作る情報だけで始められます。' : 'まずは募集に必要な基本情報から始められます。'}
          </h2>
          <div className="relative mt-6">
            <div className="absolute left-[19px] top-10 h-[calc(100%-52px)] w-[2px] bg-gradient-to-b from-[var(--accent-blue-mid)] to-transparent" />
            <div className="space-y-3">
              {steps.map(([step, title, body]) => (
                <div key={step} className="relative flex gap-4">
                  <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-blue)] text-sm font-bold text-white shadow-sm ring-4 ring-[var(--accent-blue-soft)]">
                    {step}
                  </div>
                  <div className="flex-1 rounded-2xl border border-[var(--line-soft)] bg-white/80 px-4 py-3">
                    <p className="font-semibold text-[var(--text-main)]">{title}</p>
                    <p className="mt-0.5 text-sm text-[var(--text-sub)]">{body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="soft-panel rounded-[28px] p-7">
          <div className="badge-soft badge-blue inline-block">提供価値</div>
          <h2 className="mt-4 text-xl font-bold text-[var(--text-main)]">
            {isVendor ? '営業データを、次の一手に変える。' : '出店者管理を、案件単位で見える化する。'}
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
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
                ]
            ).map(([title, body], index) => {
              const accent = CARD_ACCENTS[index % CARD_ACCENTS.length]
              return (
                <div
                  key={title}
                  className="rounded-2xl border border-[var(--line-soft)] bg-white/70 p-4"
                  style={{ borderLeft: `2px solid ${accent.border}` }}
                >
                  <p className="text-sm font-semibold text-[var(--text-main)]">{title}</p>
                  <p className="mt-1.5 text-xs leading-6 text-[var(--text-sub)]">{body}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
