import { headers } from 'next/headers'
import type { Metadata } from 'next'
import RoleLandingPage from '@/components/RoleLandingPage'
import { detectHostAppScope } from '@/lib/domain'
import { getLandingMetadata } from '@/lib/lp-metadata'

export const dynamic = 'force-dynamic'

function getRequestOrigin() {
  const headerList = headers()
  const host = headerList.get('x-forwarded-host') ?? headerList.get('host') ?? 'kuridas-os.jp'
  const protocol = headerList.get('x-forwarded-proto') ?? (host.includes('localhost') ? 'http' : 'https')
  return `${protocol}://${host}`
}

function getLandingRole() {
  const headerList = headers()
  const host = headerList.get('x-forwarded-host') ?? headerList.get('host') ?? ''
  return detectHostAppScope(host) === 'organizer' ? 'organizer' : 'vendor'
}

export function generateMetadata(): Metadata {
  const role = getLandingRole()
  const meta = getLandingMetadata(role)
  const origin = getRequestOrigin()
  const canonicalUrl = new URL('/lp', origin)
  const imageUrl = new URL(`/api/og/lp?role=${role}`, origin)

  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: canonicalUrl.toString(),
    },
    openGraph: {
      type: 'website',
      url: canonicalUrl.toString(),
      siteName: 'クリダス!!',
      title: meta.ogTitle,
      description: meta.ogDescription,
      locale: 'ja_JP',
      images: [
        {
          url: imageUrl.toString(),
          width: 1200,
          height: 630,
          alt: meta.imageAlt,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: meta.ogTitle,
      description: meta.ogDescription,
      images: [imageUrl.toString()],
    },
  }
}

export default function LandingPage() {
  return <RoleLandingPage role={getLandingRole()} />
}
