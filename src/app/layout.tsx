import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'キッチンカー売上分析',
  description: 'Airレジデータをもとに出店判断を最適化するツール',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="bg-gray-50 text-gray-900 min-h-screen">
        <nav className="bg-white border-b border-gray-200 px-6 py-3">
          <div className="max-w-6xl mx-auto flex items-center gap-6">
            <span className="font-bold text-blue-700 text-lg">🚚 キッチンカー分析</span>
            <div className="flex gap-4 text-sm">
              <a href="/"                       className="text-gray-600 hover:text-blue-600">ダッシュボード</a>
              <a href="/upload"                 className="text-gray-600 hover:text-blue-600">CSVアップロード</a>
              <a href="/products/master"        className="text-gray-600 hover:text-blue-600">原価マスタ</a>
              <a href="/locations"              className="text-gray-600 hover:text-blue-600">出店ログ</a>
              <a href="/analytics/locations"    className="text-gray-600 hover:text-blue-600">場所分析</a>
              <a href="/analytics/weekday"      className="text-gray-600 hover:text-blue-600">曜日分析</a>
              <a href="/analytics/hourly"       className="text-gray-600 hover:text-blue-600">時間帯分析</a>
              <a href="/analytics/products"     className="text-gray-600 hover:text-blue-600">商品分析</a>
            </div>
          </div>
        </nav>
        <main className="max-w-6xl mx-auto px-6 py-8">
          {children}
        </main>
      </body>
    </html>
  )
}
