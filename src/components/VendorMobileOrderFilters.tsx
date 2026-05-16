'use client'

import { memo } from 'react'

type VendorMobileOrderFiltersProps<T extends string> = {
  filters: Array<{ key: T; label: string; count: number }>
  activeFilter: T
  onChange: (filter: T) => void
}

function VendorMobileOrderFiltersComponent<T extends string>({
  filters,
  activeFilter,
  onChange,
}: VendorMobileOrderFiltersProps<T>) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {filters.map((filter) => (
        <button
          key={filter.key}
          type="button"
          onClick={() => onChange(filter.key)}
          className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
            activeFilter === filter.key
              ? 'bg-[var(--accent-blue)] text-white'
              : 'bg-white text-slate-700 ring-1 ring-[var(--line-soft)] hover:bg-slate-50'
          }`}
        >
          {filter.label} {filter.count}
        </button>
      ))}
    </div>
  )
}

export const VendorMobileOrderFilters = memo(
  VendorMobileOrderFiltersComponent
) as typeof VendorMobileOrderFiltersComponent
