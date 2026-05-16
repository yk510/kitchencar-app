'use client'

import { VendorMobileOrderScheduleSwitcher } from '@/components/VendorMobileOrderScheduleSwitcher'
import type { StoreOrderScheduleRow, VendorMobileOrderOrdersSummaryPayload } from '@/types/api-payloads'

type VendorMobileOrderScheduleOverviewProps = {
  schedules: StoreOrderScheduleRow[]
  selectedSchedule:
    | {
        id: string
        opens_at: string
        closes_at: string
        business_date: string
      }
    | null
  storeName: string
  counts: VendorMobileOrderOrdersSummaryPayload
  formatDateTime: (value: string) => string
  onChangeSchedule: (scheduleId: string) => void
}

export function VendorMobileOrderScheduleOverview({
  schedules,
  selectedSchedule,
  storeName,
  counts,
  formatDateTime,
  onChangeSchedule,
}: VendorMobileOrderScheduleOverviewProps) {
  return (
    <>
      <div className="grid gap-3 lg:grid-cols-[minmax(280px,1.5fr)_repeat(4,minmax(0,1fr))]">
        <section className="soft-panel p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">対象営業枠</p>
              <h2 className="mt-1 text-base font-semibold text-gray-800">
                {selectedSchedule
                  ? `${formatDateTime(selectedSchedule.opens_at)} - ${formatDateTime(selectedSchedule.closes_at)}`
                  : '営業枠未選択'}
              </h2>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {counts.total}件
            </span>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            {selectedSchedule ? `営業日 ${selectedSchedule.business_date} / ${storeName}` : 'まず営業スケジュールを追加してください'}
          </p>
        </section>
        <section className="soft-panel p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">受付済</p>
          <p className="mt-2 text-2xl font-bold text-sky-700">{counts.placed}</p>
        </section>
        <section className="soft-panel p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">調理中</p>
          <p className="mt-2 text-2xl font-bold text-violet-700">{counts.preparing}</p>
        </section>
        <section className="soft-panel p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">完成</p>
          <p className="mt-2 text-2xl font-bold text-emerald-700">{counts.ready}</p>
        </section>
        <section className="soft-panel p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-400">受取済</p>
          <p className="mt-2 text-2xl font-bold text-slate-700">{counts.picked_up}</p>
        </section>
      </div>

      <section className="soft-panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-800">営業枠を切り替える</h2>
            <p className="mt-1 text-xs text-gray-500">当日や過去の営業枠をすばやく切り替えられます。</p>
          </div>
        </div>
        <VendorMobileOrderScheduleSwitcher
          schedules={schedules}
          selectedScheduleId={selectedSchedule?.id ?? null}
          labelForSchedule={(schedule) => formatDateTime(schedule.opens_at)}
          onSelect={onChangeSchedule}
        />
      </section>
    </>
  )
}
