'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type NavGroup = {
  label: string
  items: Array<{
    href: string
    label: string
    shortLabel?: string
  }>
}

const navGroups: NavGroup[] = [
  {
    label: '入力',
    items: [
      { href: '/upload', label: 'CSVアップロード', shortLabel: 'CSV' },
      { href: '/locations', label: '出店場所登録', shortLabel: '出店場所' },
      { href: '/products/master', label: '原価マスタ', shortLabel: '原価' },
    ],
  },
  {
    label: '営業',
    items: [
      { href: '/plans', label: '営業予測（β）', shortLabel: '営業予測' },
      { href: '/stall-logs', label: '出店ログ', shortLabel: '出店ログ' },
    ],
  },
  {
    label: '分析',
    items: [
      { href: '/analytics/cross', label: 'クロス分析' },
      { href: '/analytics/daily', label: '日別売上' },
      { href: '/analytics/locations', label: '場所分析' },
      { href: '/analytics/weekday', label: '曜日分析' },
      { href: '/analytics/hourly', label: '時間帯分析' },
      { href: '/analytics/products', label: '商品分析' },
      { href: '/analytics/events', label: 'イベント分析' },
    ],
  },
]

function isActivePath(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function HeaderNav() {
  const pathname = usePathname()
  const activeItem =
    pathname === '/'
      ? { href: '/', label: 'ダッシュボード' }
      : navGroups.flatMap((group) => group.items).find((item) => isActivePath(pathname, item.href)) ??
        null

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-700">
            Kitchencar Analytics
          </p>
          <div className="mt-0.5 flex items-center gap-2">
            <h1 className="truncate text-lg font-semibold text-main">キッチンカー分析</h1>
            {activeItem && (
              <span className="hidden rounded-full bg-white/85 px-2.5 py-1 text-xs text-sub ring-1 ring-[#ebe7df] sm:inline-flex">
                {activeItem.label}
              </span>
            )}
          </div>
        </div>
        <Link
          href="/"
          className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap ring-1 transition ${
            pathname === '/'
              ? 'bg-[var(--accent-blue)] text-white ring-[var(--accent-blue)] shadow-sm'
              : 'bg-white/90 text-[#616b7c] ring-[#ebe7df] hover:bg-[var(--accent-blue-soft)] hover:text-[var(--accent-blue)]'
          }`}
        >
          ダッシュボード
        </Link>
      </div>

      <div className="top-nav-group overflow-x-auto px-2 py-2">
        <div className="flex min-w-max items-center gap-2">
          {navGroups.map((group) => (
            <div key={group.label} className="flex items-center gap-2">
              <span className="rounded-full bg-[#f6f1e8] px-2.5 py-1 text-[11px] font-semibold tracking-[0.12em] text-[#9a7a45]">
                {group.label}
              </span>
              <div className="flex items-center gap-1.5">
                {group.items.map((item) => {
                  const active = isActivePath(pathname, item.href)

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`top-nav-link rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap ${
                        active
                          ? 'bg-[var(--accent-blue)] text-white shadow-sm'
                          : 'bg-white/85 text-[#616b7c] hover:bg-[var(--accent-blue-soft)]'
                      }`}
                    >
                      <span className="hidden sm:inline">{item.label}</span>
                      <span className="sm:hidden">{item.shortLabel ?? item.label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
