import Link from 'next/link'

export type AnalyticsScope = 'all' | 'normal' | 'event'

interface TabItem {
  key: AnalyticsScope
  label: string
}

export default function AnalyticsScopeTabs({
  basePath,
  currentScope,
  tabs,
}: {
  basePath: string
  currentScope: AnalyticsScope
  tabs?: TabItem[]
}) {
  const defaultTabs: TabItem[] = [
    { key: 'all', label: '全体' },
    { key: 'normal', label: '通常出店のみ' },
    { key: 'event', label: 'イベント出店のみ' },
  ]

  const useTabs = tabs ?? defaultTabs

  return (
    <div className="flex gap-2 mb-6 flex-wrap">
      {useTabs.map((tab) => {
        const active = currentScope === tab.key

        return (
          <Link
            key={tab.key}
            href={`${basePath}?scope=${tab.key}`}
            className={`rounded-full px-4 py-2 text-sm font-medium border transition ${
              active
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}