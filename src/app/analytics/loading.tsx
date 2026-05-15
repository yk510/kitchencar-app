import AnalyticsLoadingSkeleton from '@/components/AnalyticsLoadingSkeleton'

export default function AnalyticsLoading() {
  return (
    <div className="space-y-6">
      <section className="soft-panel rounded-[32px] p-6 animate-pulse">
        <div className="h-8 w-36 rounded-full bg-slate-200" />
        <div className="mt-3 h-4 w-80 max-w-full rounded-full bg-slate-100" />
        <div className="mt-5 flex gap-3">
          <div className="h-10 w-28 rounded-2xl bg-slate-100" />
          <div className="h-10 w-28 rounded-2xl bg-slate-100" />
          <div className="h-10 w-28 rounded-2xl bg-slate-100" />
        </div>
      </section>

      <AnalyticsLoadingSkeleton />
    </div>
  )
}
