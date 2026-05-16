import type { MobileOrderNotificationRow } from '@/types/api-payloads'

export function getNotificationTypeLabel(type: MobileOrderNotificationRow['notification_type']) {
  if (type === 'order_completed') return '注文完了通知'
  if (type === 'order_preparing') return '調理開始通知'
  return '完成通知'
}

export function getNotificationStatusLabel(notification: MobileOrderNotificationRow) {
  if (notification.sent_at) return '送信済み'
  if (notification.failed_at) return '送信失敗'
  return '送信待ち'
}

export function getNotificationStatusTone(notification: MobileOrderNotificationRow) {
  if (notification.sent_at) return 'bg-emerald-50 text-emerald-700'
  if (notification.failed_at) return 'bg-rose-100 text-rose-700'
  return 'bg-amber-100 text-amber-800'
}
