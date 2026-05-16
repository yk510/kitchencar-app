'use client'

import Link from 'next/link'

type VendorMobileOrderDashboardHeaderProps = {
  notificationsEnabled: boolean
  onEnableNotifications: () => void
  onBack: () => void
}

export function VendorMobileOrderDashboardHeader({
  notificationsEnabled,
  onEnableNotifications,
  onBack,
}: VendorMobileOrderDashboardHeaderProps) {
  return (
    <>
      <section className="flex justify-end">
        <div className="flex flex-wrap items-center gap-2 rounded-full border border-[var(--line-soft)] bg-white/90 px-2 py-2 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center justify-center rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-[var(--line-soft)] transition hover:bg-slate-50"
          >
            前に戻る
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-[var(--line-soft)] transition hover:bg-slate-50"
          >
            ホームへ
          </Link>
        </div>
      </section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="badge-blue badge-soft inline-block mb-3">注文ダッシュボード</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">モバイルオーダーの受注をさばく</h1>
          <p className="text-sm text-gray-500">
            注文番号、ニックネーム、内容、受注時刻を見ながら、調理から受け渡しまでの状態を更新できます。
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <button
            type="button"
            onClick={onEnableNotifications}
            className={`rounded-full px-4 py-2 font-medium transition ${
              notificationsEnabled
                ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                : 'bg-white text-[var(--accent-blue)] ring-1 ring-[var(--accent-blue-soft)] hover:bg-[var(--accent-blue-soft)]'
            }`}
          >
            {notificationsEnabled ? '通知有効化済み' : '通知を有効化'}
          </button>
          <Link
            href="/vendor/mobile-order"
            className="rounded-full bg-slate-100 px-4 py-2 font-medium text-slate-700 transition hover:bg-slate-200"
          >
            モバイル注文トップへ戻る
          </Link>
          <Link
            href="/vendor/mobile-order/products"
            className="rounded-full bg-white px-4 py-2 font-medium text-[var(--accent-blue)] ring-1 ring-[var(--accent-blue-soft)] transition hover:bg-[var(--accent-blue-soft)]"
          >
            商品管理へ
          </Link>
        </div>
      </div>
    </>
  )
}
