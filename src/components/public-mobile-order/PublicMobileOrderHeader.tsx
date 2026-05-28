import { formatPublicMobileOrderDateTime } from '@/lib/public-mobile-order-ui'
import type { PublicMobileOrderPagePayload } from '@/types/api-payloads'

type PublicMobileOrderHeaderProps = {
  store: PublicMobileOrderPagePayload['store']
  activeSchedule: PublicMobileOrderPagePayload['activeSchedule']
  nextSchedule: PublicMobileOrderPagePayload['nextSchedule']
}

export default function PublicMobileOrderHeader({
  store,
  activeSchedule,
  nextSchedule,
}: PublicMobileOrderHeaderProps) {
  return (
    <section className="soft-panel rounded-[36px] px-6 py-7 lg:px-8">
      <div className="flex flex-wrap items-center gap-2">
        <span className="badge-soft badge-blue">MOBILE ORDER</span>
        <span
          className={`rounded-full px-3 py-1 text-[11px] font-semibold tracking-[0.12em] ${
            activeSchedule ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'
          }`}
        >
          {activeSchedule ? 'OPEN' : 'CLOSED'}
        </span>
      </div>

      <h1 className="mt-4 text-3xl font-black tracking-tight text-[var(--text-main)] lg:text-4xl">
        {store.store_name}
      </h1>

      <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--text-sub)]">
        {store.description || '店頭のQRコードから、モバイルオーダーで事前注文できます。'}
      </p>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <div className="rounded-3xl border border-[var(--line-soft)] bg-white px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">受付状態</p>
          <p className={`mt-2 text-lg font-semibold ${activeSchedule ? 'text-emerald-700' : 'text-amber-700'}`}>
            {activeSchedule ? '受付中' : '受付時間外'}
          </p>
        </div>
        <div className="rounded-3xl border border-[var(--line-soft)] bg-white px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">現在の受付時間</p>
          <p className="mt-2 text-sm font-medium text-gray-700">
            {activeSchedule
              ? `${formatPublicMobileOrderDateTime(activeSchedule.opens_at)} - ${formatPublicMobileOrderDateTime(activeSchedule.closes_at)}`
              : '現在有効な営業枠はありません'}
          </p>
        </div>
        <div className="rounded-3xl border border-[var(--line-soft)] bg-white px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">次回受付予定</p>
          <p className="mt-2 text-sm font-medium text-gray-700">
            {nextSchedule ? formatPublicMobileOrderDateTime(nextSchedule.opens_at) : '未定'}
          </p>
        </div>
      </div>
    </section>
  )
}
