'use client'

import { memo } from 'react'

type VendorMobileOrderStatusSectionProps = {
  orderId: string
  orderNumber: string
  status: string
  paymentStatus: string
  isStorePos: boolean
  receiptPrintEnabled: boolean
  pendingStatus: string | null
  pendingPaymentReceiptOrderId: string | null
  pendingReprintOrderId: string | null
  nextActions: Array<{ status: string; label: string }>
  onReceivePayment: (orderId: string, orderNumber: string) => void
  onChangeStatus: (orderId: string, orderNumber: string, nextStatus: string) => void
  onReprintReceipt: (orderId: string, orderNumber: string) => void
}

function VendorMobileOrderStatusSectionComponent({
  orderId,
  orderNumber,
  status,
  paymentStatus,
  isStorePos,
  receiptPrintEnabled,
  pendingStatus,
  pendingPaymentReceiptOrderId,
  pendingReprintOrderId,
  nextActions,
  onReceivePayment,
  onChangeStatus,
  onReprintReceipt,
}: VendorMobileOrderStatusSectionProps) {
  return (
    <div className="rounded-3xl border border-[var(--line-soft)] bg-white p-4">
      <h3 className="text-base font-semibold text-gray-800">ステータスを進める</h3>
      {isStorePos && paymentStatus !== 'paid' ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-amber-900">まだ料金受領が記録されていません</p>
              <p className="mt-1 text-xs text-amber-800">
                現金または PayPay の受領後に、このボタンで会計完了を記録します。
              </p>
            </div>
            <button
              type="button"
              onClick={() => onReceivePayment(orderId, orderNumber)}
              disabled={pendingPaymentReceiptOrderId === orderId}
              className="rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-600 disabled:opacity-60"
            >
              {pendingPaymentReceiptOrderId === orderId ? '記録中...' : '料金受領を記録'}
            </button>
          </div>
        </div>
      ) : null}
      {isStorePos && paymentStatus === 'paid' && receiptPrintEnabled ? (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">レシートを再印刷できます</p>
              <p className="mt-1 text-xs text-slate-600">
                再印刷時は、印字面に「再印刷」の印が付いた状態で出力されます。
              </p>
            </div>
            <button
              type="button"
              onClick={() => onReprintReceipt(orderId, orderNumber)}
              disabled={pendingReprintOrderId === orderId}
              className="rounded-full border border-[var(--accent-blue)] px-4 py-2 text-sm font-semibold text-[var(--accent-blue)] transition hover:bg-blue-50 disabled:opacity-60"
            >
              {pendingReprintOrderId === orderId ? '再印刷中...' : 'レシートを再印刷'}
            </button>
          </div>
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-3">
        {nextActions.length === 0 ? (
          <p className="text-sm text-gray-500">この注文はこれ以上ステータスを進められません。</p>
        ) : (
          nextActions.map((action) => (
            <button
              key={action.status}
              type="button"
              disabled={pendingStatus != null}
              onClick={() => onChangeStatus(orderId, orderNumber, action.status)}
              className="rounded-full bg-[var(--accent-blue)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {pendingStatus === action.status ? '更新中...' : action.label}
            </button>
          ))
        )}
      </div>
    </div>
  )
}

export const VendorMobileOrderStatusSection = memo(
  VendorMobileOrderStatusSectionComponent,
  (prev, next) =>
    prev.orderId === next.orderId &&
    prev.status === next.status &&
    prev.paymentStatus === next.paymentStatus &&
    prev.receiptPrintEnabled === next.receiptPrintEnabled &&
    prev.pendingStatus === next.pendingStatus &&
    prev.pendingPaymentReceiptOrderId === next.pendingPaymentReceiptOrderId &&
    prev.pendingReprintOrderId === next.pendingReprintOrderId &&
    prev.nextActions === next.nextActions
)
