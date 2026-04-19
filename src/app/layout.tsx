import type { Metadata } from 'next'
import AppShell from '@/components/AppShell'
import { AuthProvider } from '@/components/AuthProvider'
import { BRAND_CONCEPT, BRAND_NAME, BRAND_STAGE } from '@/lib/brand'
import './globals.css'

export const metadata: Metadata = {
  title: `${BRAND_NAME} ${BRAND_STAGE} | ${BRAND_CONCEPT}`,
  description: BRAND_CONCEPT,
  applicationName: BRAND_NAME,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  )
}
