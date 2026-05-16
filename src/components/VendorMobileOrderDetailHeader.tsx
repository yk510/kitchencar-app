'use client'

type VendorMobileOrderDetailHeaderProps = {
  orderNumber: string
  statusLabel: string
  statusTone: string
  isStorePos: boolean
  paymentMethodLabel: string
  pickupNickname: string
  orderedAtLabel: string
  paymentStatusLabel: string
  totalAmountLabel: string
}

export function VendorMobileOrderDetailHeader({
  orderNumber,
  statusLabel,
  statusTone,
  isStorePos,
  paymentMethodLabel,
  pickupNickname,
  orderedAtLabel,
  paymentStatusLabel,
  totalAmountLabel,
}: VendorMobileOrderDetailHeaderProps) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-2xl font-bold text-[var(--accent-blue)]">{orderNumber}</h2>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone}`}>{statusLabel}</span>
          {isStorePos ? (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
              店頭POS / {paymentMethodLabel}
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-sm text-gray-700">受け取り名: {pickupNickname}</p>
        <p className="mt-1 text-sm text-gray-500">注文時刻: {orderedAtLabel}</p>
        <p className="mt-1 text-sm text-gray-500">支払状況: {paymentStatusLabel}</p>
      </div>
      <div className="text-right">
        <p className="text-sm text-gray-500">合計</p>
        <p className="text-xl font-bold text-gray-800">{totalAmountLabel}</p>
      </div>
    </div>
  )
}
