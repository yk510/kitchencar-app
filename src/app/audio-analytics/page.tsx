import AudioAnalyticsDashboardClient from '@/components/AudioAnalyticsDashboardClient'
import { requireServerSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function AudioAnalyticsDashboardPage() {
  await requireServerSession({ includeProfile: false })

  return <AudioAnalyticsDashboardClient />
}
