'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { fetchApi } from '@/lib/api-client'
import {
  BRAND_CONCEPT,
  BRAND_NAME,
  BRAND_NAME_LATIN,
  BRAND_STAGE,
  getBoardTitle,
  getWorkspaceLabel,
} from '@/lib/brand'
import { getHomePathByRole } from '@/lib/user-role'
import type { NotificationsUnreadCountPayload } from '@/types/api-payloads'

type NavGroup = {
  label: string
  items: Array<{
    href: string
    label: string
    shortLabel?: string
  }>
}

const vendorNavGroups: NavGroup[] = [
  {
    label: '準備',
    items: [
      { href: '/upload', label: '売上データ取込', shortLabel: '売上' },
      { href: '/locations', label: '出店場所登録', shortLabel: '場所' },
      { href: '/products/master', label: '原価登録', shortLabel: '原価' },
    ],
  },
  {
    label: '営業',
    items: [
      { href: '/vendor/offers', label: '募集を探す', shortLabel: '募集' },
      { href: '/vendor/applications', label: '応募状況', shortLabel: '応募' },
      { href: '/plans', label: '営業予測（β）', shortLabel: '予測' },
      { href: '/stall-logs', label: '出店ログ', shortLabel: '出店ログ' },
    ],
  },
  {
    label: 'ふり返り',
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

const organizerNavGroups: NavGroup[] = [
  {
    label: '主催',
    items: [
      { href: '/organizer', label: '主催ダッシュボード', shortLabel: 'ホーム' },
      { href: '/organizer/offers', label: '募集管理', shortLabel: '募集' },
      { href: '/organizer/applications', label: '応募管理', shortLabel: '応募' },
    ],
  },
]

function isActivePath(pathname: string, href: string) {
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export default function HeaderNav() {
  const pathname = usePathname()
  const { supabase, user, role } = useAuth()
  const navGroups = role === 'organizer' ? organizerNavGroups : vendorNavGroups
  const homePath = getHomePathByRole(role)
  const [menuOpen, setMenuOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const inboxPath = role === 'organizer' ? '/organizer/applications' : '/vendor/applications'
  const activeItem =
    pathname === homePath
      ? { href: homePath, label: role === 'organizer' ? '主催ダッシュボード' : 'ダッシュボード' }
      : navGroups.flatMap((group) => group.items).find((item) => isActivePath(pathname, item.href)) ??
        null

  async function handleSignOut() {
    if (!supabase) return
    await supabase.auth.signOut()
  }

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  useEffect(() => {
    if (!user) return

    async function loadUnreadCount() {
      try {
        const data = await fetchApi<NotificationsUnreadCountPayload>('/api/notifications/unread-count', {
          cache: 'no-store',
        })
        setUnreadCount(Number(data.count ?? 0))
      } catch {
        setUnreadCount(0)
      }
    }

    loadUnreadCount()
  }, [pathname, user])

  const settingsItems =
    role === 'organizer'
      ? [
          { href: '/organizer/profile', label: '主催者設定' },
        ]
      : [
          { href: '/vendor/profile', label: '事業者設定' },
        ]

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-orange-700">
            {BRAND_NAME_LATIN} / {getWorkspaceLabel(role)}
          </p>
          <div className="mt-0.5 flex items-center gap-2">
            <h1 className="truncate text-lg font-semibold text-main">
              {BRAND_NAME}
            </h1>
            <span className="inline-flex rounded-full bg-[#eef4ff] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--accent-blue)]">
              {BRAND_STAGE}
            </span>
            <span className="hidden rounded-full bg-[#f6f1e8] px-2.5 py-1 text-[11px] font-semibold tracking-[0.08em] text-[#9a7a45] lg:inline-flex">
              {getBoardTitle(role)}
            </span>
            {activeItem && (
              <span className="hidden rounded-full bg-white/85 px-2.5 py-1 text-xs text-sub ring-1 ring-[#ebe7df] sm:inline-flex">
                {activeItem.label}
              </span>
            )}
          </div>
          <p className="mt-1 hidden text-xs text-[#7b7266] md:block">{BRAND_CONCEPT}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden rounded-full bg-white/90 px-3 py-1.5 text-xs text-[#616b7c] ring-1 ring-[#ebe7df] sm:block">
            {user?.email ?? 'ログイン中'}
          </div>
          <Link
            href={inboxPath}
            className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-[#616b7c] ring-1 ring-[#ebe7df] transition hover:bg-[#f8fbff] hover:text-[var(--accent-blue)]"
            aria-label="お知らせを開く"
          >
            <span className="text-base leading-none">🔔</span>
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>
          <Link
            href={homePath}
            className={`rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap ring-1 transition ${
              pathname === homePath
                ? 'bg-[var(--accent-blue)] text-white ring-[var(--accent-blue)] shadow-sm'
                : 'bg-white/90 text-[#616b7c] ring-[#ebe7df] hover:bg-[var(--accent-blue-soft)] hover:text-[var(--accent-blue)]'
            }`}
          >
            {role === 'organizer' ? '主催ホーム' : 'ホーム'}
          </Link>
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-[#616b7c] ring-1 ring-[#ebe7df] transition hover:bg-[#f8fbff] hover:text-[var(--accent-blue)]"
              aria-label="メニューを開く"
            >
              <span className="text-lg leading-none">☰</span>
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-12 z-50 w-56 rounded-2xl border border-[var(--line-soft)] bg-white p-2 shadow-lg">
                <div className="px-3 py-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">Settings</p>
                  <p className="mt-1 truncate text-sm text-gray-600">{user?.email ?? 'ログイン中'}</p>
                </div>
                <div className="my-1 h-px bg-[var(--line-soft)]" />
                {settingsItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className="flex rounded-xl px-3 py-2 text-sm text-gray-700 transition hover:bg-[var(--accent-blue-soft)] hover:text-[var(--accent-blue)]"
                  >
                    {item.label}
                  </Link>
                ))}
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="mt-1 flex w-full rounded-xl px-3 py-2 text-left text-sm text-red-600 transition hover:bg-red-50"
                >
                  ログアウト
                </button>
              </div>
            )}
          </div>
        </div>
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
