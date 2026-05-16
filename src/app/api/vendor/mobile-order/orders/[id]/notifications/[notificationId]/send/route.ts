import { NextRequest } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import { sendVendorOrderNotification } from '@/lib/vendor-mobile-order-dashboard-mutations'
import type { MobileOrderNotificationRow } from '@/types/api-payloads'

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string; notificationId: string }> }
) {
  const auth = await requireRouteSession(req)
  if (auth.response) return auth.response

  if (auth.session.role !== 'vendor') {
    return apiError('ベンダー権限が必要です', 403)
  }

  const { id, notificationId } = await context.params
  const { supabase, user } = auth.session

  try {
    const payload: MobileOrderNotificationRow = await sendVendorOrderNotification(
      supabase,
      user,
      id,
      notificationId
    )
    return apiOk(payload)
  } catch (error) {
    console.error('[vendor/mobile-order/orders/:id/notifications/:notificationId/send POST]', error)
    const message = error instanceof Error ? error.message : 'サーバーエラー'
    const status = message === '対象の注文が見つかりません' || message === '対象の通知が見つかりません' ? 404 : 500
    return apiError(message, status)
  }
}
