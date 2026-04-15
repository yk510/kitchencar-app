import type { Metadata } from 'next'
import HeaderNav from '@/components/HeaderNav'
import './globals.css'

export const metadata: Metadata = {
  title: 'キッチンカー売上分析',
  description: 'Airレジデータをもとに出店判断を最適化するツール',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <nav className="top-nav-wrap sticky top-0 z-30 px-4 py-2.5 lg:px-6">
          <div className="mx-auto max-w-7xl">
            <HeaderNav />
          </div>
        </nav>
        <main className="mx-auto max-w-7xl px-6 py-6">{children}</main>
      </body>
    </html>
  )
}
