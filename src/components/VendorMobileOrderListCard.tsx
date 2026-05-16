'use client'

import { memo } from 'react'
import { isStorePosOrder } from '@/lib/mobile-order-fields'
import type { VendorMobileOrderListItem } from '@/types/api-payloads'

type VendorMobileOrderListCardProps = {
  order: VendorMobileOrderListItem
  selected: boolean
  isNew: boolean
  statusLabel: string
  statusTone: string
  paymentStatusLabel: string
  paymentMethodLabel: string
  orderedAtLabel: string
  totalAmountLabel: string
  onSelect: (orderId: string) => void
}

function VendorMobileOrderListCardComponent({
  order,
  selected,
  isNew,
  statusLabel,
  statusTone,
  paymentStatusLabel,
  paymentMethodLabel,
  orderedAtLabel,
  totalAmountLabel,
  onSelect,
}: VendorMobileOrderListCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(order.id)}
      className={`w-full rounded-3xl border px-4 py-4 text-left transition ${
        selected
          ? 'border-[var(--accent-blue)] bg-[var(--accent-blue-soft)]'
          : isNew
            ? 'border-amber-300 bg-amber-50 shadow-[0_12px_28px_rgba(245,158,11,0.16)]'
            : 'border-[var(--line-soft)] bg-white hover:border-[var(--accent-blue-soft)]'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-bold text-[var(--accent-blue)]">{order.order_number}</p>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone}`}>
              {statusLabel}
            </span>
            {isStorePosOrder(order) ? (
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                POS / {paymentMethodLabel}
              </span>
            ) : null}
            {isNew ? (
              <span className="rounded-full bg-amber-500 px-3 py-1 text-xs font-semibold text-white">
                新着
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-sm font-medium text-gray-800">{order.pickup_nickname}</p>
          <p className="mt-1 text-xs text-gray-500">{orderedAtLabel}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-gray-800">{totalAmountLabel}</p>
          <p className="mt-1 text-xs text-gray-500">
            {order.item_count} 品目 / {paymentStatusLabel}
          </p>
        </div>
      </div>
    </button>
  )
}

export const VendorMobileOrderListCard = memo(
  VendorMobileOrderListCardComponent,
  (prev, next) =>
    prev.order.id === next.order.id &&
    prev.order.status === next.order.status &&
    prev.order.payment_status === next.order.payment_status &&
    prev.order.total_amount === next.order.total_amount &&
    prev.order.item_count === next.order.item_count &&
    prev.order.pickup_nickname === next.order.pickup_nickname &&
    prev.order.ordered_at === next.order.ordered_at &&
    prev.selected === next.selected &&
    prev.isNew === next.isNew
)
