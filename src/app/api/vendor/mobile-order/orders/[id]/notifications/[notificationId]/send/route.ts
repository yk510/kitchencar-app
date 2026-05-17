import { NextRequest } from 'next/server'
import { sendVendorOrderNotification } from '@/lib/vendor-mobile-order-dashboard-mutations'
import type { MobileOrderNotificationRow } from '@/types/api-payloads'
import { executeVendorMobileOrderRoute } from '@/lib/vendor-mobile-order-route'

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string; notificationId: string }> }
) {
  const { id, notificationId } = await context.params
  return executeVendorMobileOrderRoute<MobileOrderNotificationRow>(
    req,
    '[vendor/mobile-order/orders/:id/notifications/:notificationId/send POST]',
    async ({ supabase, user }) => sendVendorOrderNotification(supabase, user, id, notificationId),
    {
      notFound: ['対象の注文が見つかりません', '対象の通知が見つかりません'],
    }
  )
}
