'use client'

import { memo } from 'react'
import type { MobileOrderNotificationRow } from '@/types/api-payloads'

type VendorMobileOrderNotificationsSectionProps = {
  orderId: string
  customerLineUserId: string | null
  customerLineDisplayName: string | null
  notifications: MobileOrderNotificationRow[]
  pendingNotificationId: string | null
  maskLineUserId: (value: string | null | undefined) => string
  getNotificationTypeLabel: (type: MobileOrderNotificationRow['notification_type']) => string
  getNotificationStatusTone: (notification: MobileOrderNotificationRow) => string
  getNotificationStatusLabel: (notification: MobileOrderNotificationRow) => string
  formatDateTime: (value: string) => string
  onSendNotification: (orderId: string, notification: MobileOrderNotificationRow) => void
}

function VendorMobileOrderNotificationsSectionComponent({
  orderId,
  customerLineUserId,
  customerLineDisplayName,
  notifications,
  pendingNotificationId,
  maskLineUserId,
  getNotificationTypeLabel,
  getNotificationStatusTone,
  getNotificationStatusLabel,
  formatDateTime,
  onSendNotification,
}: VendorMobileOrderNotificationsSectionProps) {
  return (
    <div className="rounded-3xl border border-[var(--line-soft)] bg-white p-4">
      <h3 className="text-base font-semibold text-gray-800">通知状況</h3>
      <p className="mt-2 text-sm text-gray-500">
        送信待ちの通知は、ここから手動でLINE送信できます。LIFF連携前は userId 未取得のため失敗理由もここに残ります。
      </p>
      <div className="mt-4 rounded-2xl border border-[var(--line-soft)] bg-[#fafafa] px-4 py-4 text-xs text-gray-600">
        <p>
          customer_line_user_id:{' '}
          <span className="font-semibold text-gray-800">{maskLineUserId(customerLineUserId)}</span>
        </p>
        <p className="mt-1">
          LINE表示名:{' '}
          <span className="font-semibold text-gray-800">{customerLineDisplayName || '未保存'}</span>
        </p>
      </div>
      <div className="mt-4 space-y-3">
        {notifications.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--line-soft)] bg-[#fafafa] px-4 py-4 text-sm text-gray-500">
            まだ通知履歴はありません。
          </div>
        ) : (
          notifications
            .slice()
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .map((notification) => (
              <div
                key={notification.id}
                className="rounded-2xl border border-[var(--line-soft)] bg-[#fafafa] px-4 py-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-gray-800">
                        {getNotificationTypeLabel(notification.notification_type)}
                      </p>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${getNotificationStatusTone(notification)}`}
                      >
                        {getNotificationStatusLabel(notification)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      作成日時: {formatDateTime(notification.created_at)}
                    </p>
                    {notification.error_message && (
                      <p className="mt-2 text-xs text-gray-500">{notification.error_message}</p>
                    )}
                    <div className="mt-2 text-[11px] text-gray-400">
                      <p>delivery_status: {notification.delivery_status}</p>
                      <p>line_message_id: {notification.line_message_id || '未設定'}</p>
                    </div>
                    {!notification.sent_at && (
                      <button
                        type="button"
                        onClick={() => onSendNotification(orderId, notification)}
                        disabled={pendingNotificationId != null}
                        className="mt-3 rounded-full bg-[var(--accent-blue)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        {pendingNotificationId === notification.id
                          ? '送信中...'
                          : notification.failed_at
                            ? 'LINE通知を再送する'
                            : 'LINE通知を送る'}
                      </button>
                    )}
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    {notification.sent_at && <p>送信: {formatDateTime(notification.sent_at)}</p>}
                    {notification.failed_at && <p>失敗: {formatDateTime(notification.failed_at)}</p>}
                  </div>
                </div>
              </div>
            ))
        )}
      </div>
    </div>
  )
}

export const VendorMobileOrderNotificationsSection = memo(
  VendorMobileOrderNotificationsSectionComponent,
  (prev, next) =>
    prev.orderId === next.orderId &&
    prev.customerLineUserId === next.customerLineUserId &&
    prev.customerLineDisplayName === next.customerLineDisplayName &&
    prev.notifications === next.notifications &&
    prev.pendingNotificationId === next.pendingNotificationId
)
