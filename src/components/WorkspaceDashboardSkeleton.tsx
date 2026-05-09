'use client'

export default function WorkspaceDashboardSkeleton({
  title = 'ダッシュボードを準備しています',
  description = '数字と最近の状況をまとめています。表示までそのままお待ちください。',
}: {
  title?: string
  description?: string
}) {
  return (
    <div className="space-y-6">
      <div className="soft-panel rounded-[32px] px-8 py-8">
        <div className="h-6 w-28 animate-pulse rounded-full bg-[var(--accent-blue-soft)]" />
        <div className="mt-5 h-10 w-80 max-w-full animate-pulse rounded-2xl bg-[#eef1f6]" />
        <div className="mt-4 h-5 w-[32rem] max-w-full animate-pulse rounded-xl bg-[#f2f5f9]" />
        <p className="mt-6 text-sm font-semibold text-[var(--text-main)]">{title}</p>
        <p className="mt-1 text-sm leading-7 text-[var(--text-sub)]">{description}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="kpi-card p-6">
            <div className="h-4 w-24 animate-pulse rounded-lg bg-[#eef1f6]" />
            <div className="mt-4 h-10 w-36 animate-pulse rounded-xl bg-[#e5ebf5]" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="soft-panel p-6">
          <div className="h-5 w-40 animate-pulse rounded-lg bg-[#eef1f6]" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="rounded-2xl border border-[var(--line-soft)] bg-white px-4 py-4">
                <div className="h-4 w-48 animate-pulse rounded-lg bg-[#eef1f6]" />
                <div className="mt-2 h-3 w-full animate-pulse rounded-lg bg-[#f3f5f8]" />
              </div>
            ))}
          </div>
        </div>

        <div className="soft-panel p-6">
          <div className="h-5 w-32 animate-pulse rounded-lg bg-[#eef1f6]" />
          <div className="mt-4 space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index}>
                <div className="h-4 w-28 animate-pulse rounded-lg bg-[#eef1f6]" />
                <div className="mt-2 h-8 w-40 animate-pulse rounded-xl bg-[#e5ebf5]" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
