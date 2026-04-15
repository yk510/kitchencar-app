import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'

export const metadata: Metadata = {
  title: 'キッチンカー売上分析',
  description: 'Airレジデータをもとに出店判断を最適化するツール',
}

const navItems = [
  { href: '/', label: 'ダッシュボード' },
  { href: '/upload', label: 'CSVアップロード' },
  { href: '/plans', label: '営業予定' },
  { href: '/locations', label: '出店場所管理' },
  { href: '/stall-logs', label: '出店ログ' },
  { href: '/products/master', label: '原価マスタ' },
  { href: '/analytics/daily', label: '日別売上' },
  { href: '/analytics/locations', label: '場所分析' },
  { href: '/analytics/weekday', label: '曜日分析' },
  { href: '/analytics/hourly', label: '時間帯分析' },
  { href: '/analytics/products', label: '商品分析' },
  { href: '/analytics/events', label: 'イベント分析' },
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <nav className="border-b border-gray-200 bg-white px-6 py-3">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-lg font-bold text-blue-700">キッチンカー分析</span>
              <div className="flex flex-wrap gap-3 text-sm">
                {navItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-full px-3 py-1.5 text-gray-600 transition hover:bg-blue-50 hover:text-blue-700"
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </nav>
        <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
      </body>
    </html>
  )
}
