'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { usePersistentDraft } from '@/lib/usePersistentDraft'

type Role = 'vendor' | 'organizer'

const roleCards: Array<{
  role: Role
  badge: string
  title: string
  description: string
  points: string[]
}> = [
  {
    role: 'vendor',
    badge: 'キッチンカー向け',
    title: '出店事業者として使う',
    description: '売上分析、原価管理、営業予測、出店ログを中心に使う方向けです。',
    points: ['売上データ取込', '原価登録', '営業予測', 'クロス分析'],
  },
  {
    role: 'organizer',
    badge: '主催者向け',
    title: 'イベント主催者として使う',
    description: '募集作成、出店者募集、今後の応募管理や運営管理を使う方向けです。',
    points: ['主催者設定', '募集管理', '応募管理へ拡張予定', '主催者ホーム'],
  },
]

export default function AccountRolePage() {
  const router = useRouter()
  const { role, refreshProfile } = useAuth()
  const draftState = usePersistentDraft('draft:account-role-form', {
    selectedRole: (role ?? 'vendor') as Role,
    displayName: '',
  })
  const { value: draft, setValue: setDraft, clearDraft } = draftState
  const [selectedRole, setSelectedRole] = useState<Role>(draft.selectedRole)
  const [displayName, setDisplayName] = useState(draft.displayName)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setSelectedRole(draft.selectedRole)
    setDisplayName(draft.displayName)
  }, [draft.displayName, draft.selectedRole])

  useEffect(() => {
    setDraft({ selectedRole, displayName })
  }, [displayName, selectedRole, setDraft])

  async function handleSave() {
    setSaving(true)
    setError(null)

    try {
      const res = await fetch('/api/user/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: selectedRole,
          display_name: displayName,
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? '利用タイプの保存に失敗しました')
        return
      }

      await refreshProfile()
      clearDraft()
      router.replace(selectedRole === 'organizer' ? '/organizer' : '/')
    } catch {
      setError('通信エラーが発生しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <div className="badge-blue badge-soft inline-block mb-3">利用タイプ</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">どちらの立場で使うか選ぶ</h1>
        <p className="text-sm text-gray-500">
          表示されるホームとナビゲーションを、あなたの使い方に合わせて切り替えます。
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {roleCards.map((item) => {
          const active = selectedRole === item.role

          return (
            <label
              key={item.role}
              className={`soft-panel block cursor-pointer p-6 text-left transition ${
                active ? 'border-[var(--accent-blue)] ring-2 ring-[var(--accent-blue)]' : 'hover:border-[var(--line-mid)]'
              }`}
            >
              <input
                type="radio"
                name="app-role"
                value={item.role}
                checked={active}
                onChange={() => setSelectedRole(item.role)}
                className="sr-only"
              />
              <span className="badge-soft badge-blue">{item.badge}</span>
              <div className="mt-4 flex items-start justify-between gap-3">
                <h2 className="text-xl font-semibold text-gray-800">{item.title}</h2>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    active
                      ? 'bg-[var(--accent-blue)] text-white'
                      : 'bg-white text-gray-500 ring-1 ring-[var(--line-soft)]'
                  }`}
                >
                  {active ? '選択中' : '選ぶ'}
                </span>
              </div>
              <p className="mt-2 text-sm leading-7 text-gray-600">{item.description}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {item.points.map((point) => (
                  <span key={point} className="rounded-full bg-white px-3 py-1 text-xs text-gray-600 ring-1 ring-[var(--line-soft)]">
                    {point}
                  </span>
                ))}
              </div>
            </label>
          )
        })}
      </div>

      <div className="soft-panel p-6">
        <label className="mb-2 block text-sm font-medium text-gray-700">表示名（任意）</label>
        <input
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          className="w-full px-4 py-3"
          placeholder="例: 匠 Soup Curry / まちなかマルシェ実行委員会"
        />

        {error && <p className="alert-danger mt-4 px-4 py-3 text-sm text-red-700">{error}</p>}

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="soft-button mt-5 w-full rounded-full bg-blue-600 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
        >
          {saving ? '保存中...' : 'この利用タイプで始める'}
        </button>
      </div>
    </div>
  )
}
