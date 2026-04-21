import { headers } from 'next/headers'
import RoleLandingPage from '@/components/RoleLandingPage'
import { detectHostAppScope } from '@/lib/domain'

export const dynamic = 'force-dynamic'

export default function LandingPage() {
  const scope = detectHostAppScope(headers().get('host') ?? '')
  return <RoleLandingPage role={scope === 'organizer' ? 'organizer' : 'vendor'} />
}
