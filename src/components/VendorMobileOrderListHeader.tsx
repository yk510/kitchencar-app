'use client'

type VendorMobileOrderListHeaderProps = {
  visibleCount: number
  totalCount: number
  hasSelectedSchedule: boolean
}

export function VendorMobileOrderListHeader({
  visibleCount,
  totalCount,
  hasSelectedSchedule,
}: VendorMobileOrderListHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <h2 className="text-base font-semibold text-gray-800">注文一覧</h2>
        <p className="mt-1 text-xs text-gray-500">
          {hasSelectedSchedule ? `${visibleCount} / ${totalCount} 件を表示中` : '営業枠を選択してください'}
        </p>
      </div>
    </div>
  )
}
