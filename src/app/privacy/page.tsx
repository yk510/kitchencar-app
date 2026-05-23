import type { Metadata } from 'next'
import { BRAND_NAME } from '@/lib/brand'

export const metadata: Metadata = {
  title: `プライバシーポリシー | ${BRAND_NAME}`,
  description: `${BRAND_NAME} のプライバシーポリシー`,
}

const sections = [
  {
    title: '取得する情報',
    body: [
      'ログインに必要なメールアドレス、認証情報、アカウント種別、表示名を取得します。',
      '店舗名、店舗コード、営業スケジュール、出店場所、商品、注文受付設定、プリンター設定など、店舗運営に必要な情報を取得します。',
      '注文番号、注文内容、数量、オプション、支払方法、支払状態、注文状態、注文日時などの注文情報を取得します。',
      '売上金額、料金受領記録、取引状態、キャンセル記録など、売上や取引の管理に必要な情報を取得します。',
    ],
  },
  {
    title: '端末情報とログ',
    body: [
      'アプリやWebサービスの安定運用、障害調査、不正利用防止のため、アクセス日時、画面URL、ブラウザまたはWebViewの動作ログ、エラー内容などを取得する場合があります。',
      'iPadアプリでBluetoothプリンターを利用する場合、プリンター接続状態、印刷要求、印刷結果、エラー内容を、注文番号レシートの印刷と障害調査のために扱います。',
      'Bluetoothプリンターの接続設定は、印刷機能を提供する目的で端末またはサービス上に保存される場合があります。',
    ],
  },
  {
    title: '利用目的',
    body: [
      'キッチンカー運営者向けの注文受付、料金受領、注文管理、商品管理、営業管理、レシート印刷機能を提供するために利用します。',
      '問い合わせ対応、障害調査、サービス改善、セキュリティ確保、利用状況の把握のために利用します。',
      '法令に基づく対応、規約違反や不正利用への対応のために利用します。',
    ],
  },
  {
    title: '第三者提供と外部サービス',
    body: [
      '法令に基づく場合を除き、本人の同意なく個人情報を第三者へ販売または提供しません。',
      '認証、データ保存、決済、通知、地図、分析などの機能提供に必要な範囲で、外部クラウドサービスやAPIを利用する場合があります。',
      '外部サービスには、機能提供に必要な最小限の情報のみを送信します。',
    ],
  },
  {
    title: '保存期間と管理',
    body: [
      '取得した情報は、サービス提供、会計記録、問い合わせ対応、法令対応に必要な期間保存します。',
      '不要になった情報は、合理的な期間内に削除または匿名化します。',
      '不正アクセス、紛失、改ざん、漏えいを防ぐため、必要な安全管理措置を講じます。',
    ],
  },
  {
    title: '開示、訂正、削除',
    body: [
      '利用者本人から、保有する個人情報の開示、訂正、利用停止、削除を求められた場合、本人確認のうえ合理的な範囲で対応します。',
      '注文、売上、取引に関する情報は、会計、監査、法令対応のため、削除依頼後も一定期間保存する場合があります。',
    ],
  },
  {
    title: 'お問い合わせ',
    body: [
      '本ポリシーや個人情報の取り扱いに関するお問い合わせは、サービス運営者または契約窓口までご連絡ください。',
      '本ポリシーは、サービス内容や法令の変更に応じて改定される場合があります。',
    ],
  },
]

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-4xl py-10">
      <section className="soft-panel px-6 py-8 md:px-10">
        <p className="badge-blue badge-soft inline-block">Privacy Policy</p>
        <h1 className="mt-4 text-3xl font-bold text-[var(--text-main)]">プライバシーポリシー</h1>
        <p className="mt-4 text-sm leading-7 text-[var(--text-sub)]">
          {BRAND_NAME} は、キッチンカー運営者向けの注文POS、注文管理、売上管理、レシート印刷機能を提供するため、
          以下の方針に基づいて利用者情報を取り扱います。
        </p>
        <p className="mt-3 text-xs text-gray-500">制定日: 2026年5月23日</p>
      </section>

      <div className="mt-6 space-y-4">
        {sections.map((section) => (
          <section key={section.title} className="soft-panel px-6 py-6 md:px-8">
            <h2 className="text-xl font-bold text-[var(--text-main)]">{section.title}</h2>
            <ul className="mt-4 space-y-3 text-sm leading-7 text-[var(--text-sub)]">
              {section.body.map((item) => (
                <li key={item} className="border-l-2 border-[var(--accent-blue-soft)] pl-4">
                  {item}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
