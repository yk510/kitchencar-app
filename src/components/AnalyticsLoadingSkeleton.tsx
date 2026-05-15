'use client'

export default function AnalyticsLoadingSkeleton({
  variant = 'cards',
}: {
  variant?: 'cards' | 'daily'
}) {
  if (variant === 'daily') {
    return (
      <div className="space-y-6 animate-pulse">
        <section className="soft-panel rounded-[32px] p-6">
          <div className="h-5 w-36 rounded-full bg-slate-200" />
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="h-12 rounded-2xl bg-slate-100" />
            <div className="h-12 rounded-2xl bg-slate-100" />
            <div className="h-12 rounded-2xl bg-slate-100" />
          </div>
        </section>

        <section className="soft-panel rounded-[32px] p-6">
          <div className="h-6 w-40 rounded-full bg-slate-200" />
          <div className="mt-4 h-64 rounded-[28px] bg-slate-100" />
        </section>

        <section className="soft-panel rounded-[32px] p-6">
          <div className="h-6 w-44 rounded-full bg-slate-200" />
          <div className="mt-5 space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-14 rounded-2xl bg-slate-100" />
            ))}
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-pulse">
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="soft-card bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="h-4 w-24 rounded-full bg-slate-200" />
              <div className="h-6 w-40 rounded-full bg-slate-100" />
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {Array.from({ length: 4 }).map((__, statIndex) => (
                <div key={statIndex} className="h-20 w-28 rounded-2xl bg-slate-100" />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
