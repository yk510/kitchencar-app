'use client'

import { memo } from 'react'
import type { StoreOrderScheduleRow } from '@/types/api-payloads'

type VendorMobileOrderScheduleSwitcherProps = {
  schedules: StoreOrderScheduleRow[]
  selectedScheduleId: string | null
  labelForSchedule: (schedule: StoreOrderScheduleRow) => string
  onSelect: (scheduleId: string) => void
}

function VendorMobileOrderScheduleSwitcherComponent({
  schedules,
  selectedScheduleId,
  labelForSchedule,
  onSelect,
}: VendorMobileOrderScheduleSwitcherProps) {
  if (schedules.length === 0) {
    return <p className="text-sm text-gray-500">営業枠がまだありません。</p>
  }

  return (
    <div className="mt-3 flex flex-nowrap gap-2 overflow-x-auto pb-1">
      {schedules.map((schedule) => (
        <button
          key={schedule.id}
          type="button"
          onClick={() => onSelect(schedule.id)}
          className={`shrink-0 rounded-full px-3 py-2 text-xs font-semibold transition ${
            schedule.id === selectedScheduleId
              ? 'bg-[var(--accent-blue)] text-white'
              : 'bg-white text-slate-700 ring-1 ring-[var(--line-soft)] hover:bg-slate-50'
          }`}
        >
          {labelForSchedule(schedule)}
        </button>
      ))}
    </div>
  )
}

export const VendorMobileOrderScheduleSwitcher = memo(
  VendorMobileOrderScheduleSwitcherComponent,
  (prev, next) =>
    prev.schedules === next.schedules &&
    prev.selectedScheduleId === next.selectedScheduleId
)
