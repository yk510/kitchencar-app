import AudioAnalyticsTranscriptsClient from '@/components/AudioAnalyticsTranscriptsClient'
import { requireServerSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function AudioAnalyticsTranscriptsPage() {
  await requireServerSession({ includeProfile: false })

  return <AudioAnalyticsTranscriptsClient />
}
