'use client'

import { memo } from 'react'
import type { VendorMobileOrderDashboardItem } from '@/types/api-payloads'

type VendorMobileOrderItemsSectionProps = {
  items: VendorMobileOrderDashboardItem[]
  formatPrice: (value: number) => string
}

function VendorMobileOrderItemsSectionComponent({
  items,
  formatPrice,
}: VendorMobileOrderItemsSectionProps) {
  return (
    <div className="rounded-3xl border border-[var(--line-soft)] bg-white p-4">
      <h3 className="text-base font-semibold text-gray-800">注文内容</h3>
      <div className="mt-3 space-y-3">
        {items.map((item) => (
          <div key={item.id} className="rounded-2xl border border-[var(--line-soft)] bg-[#fafafa] px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-gray-800">
                  {item.product_name_snapshot} x {item.quantity}
                </p>
                {item.mobile_order_item_option_choices.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {item.mobile_order_item_option_choices.map((choice) => (
                      <span
                        key={choice.id}
                        className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-[var(--line-soft)]"
                      >
                        {choice.option_group_name_snapshot}: {choice.option_choice_name_snapshot}
                        {choice.price_delta_snapshot > 0 ? ` (+${choice.price_delta_snapshot}円)` : ''}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-gray-500">オプションなし</p>
                )}
              </div>
              <p className="text-sm font-semibold text-gray-800">{formatPrice(item.line_total_amount)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export const VendorMobileOrderItemsSection = memo(
  VendorMobileOrderItemsSectionComponent,
  (prev, next) => prev.items === next.items
)
