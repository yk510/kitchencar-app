import type { AppRole } from '@/lib/user-role'

export function getSignupSourceLabel(source: string | null | undefined, role: AppRole) {
  if (!source) return role === 'vendor' ? 'ベンダー向けLP' : '主催者向けLP'

  const sourceMap: Record<string, string> = {
    'vendor-lp': 'ベンダー向けLP',
    'organizer-lp': '主催者向けLP',
    login: 'ログイン画面',
  }

  return sourceMap[source] ?? source
}
