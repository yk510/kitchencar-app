import AnalyticsScopeTabs, { AnalyticsScope } from '@/components/AnalyticsScopeTabs'
import AnalyticsFilters from '@/components/AnalyticsFilters'

export default function AnalyticsPageHeader({
  title,
  description,
  scopeLabel,
  basePath,
  currentScope,
  currentStart,
  currentEnd,
  showScopeTabs = true,
  showFilters = true,
}: {
  title: string
  description?: string
  scopeLabel?: string
  basePath: string
  currentScope?: AnalyticsScope
  currentStart?: string
  currentEnd?: string
  showScopeTabs?: boolean
  showFilters?: boolean
}) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">{title}</h1>

      {description && (
        <p className="text-sm text-gray-500 mb-2">{description}</p>
      )}

      {scopeLabel && (
        <p className="text-sm text-gray-500 mb-6">現在の表示対象: {scopeLabel}</p>
      )}

      {showScopeTabs && currentScope && (
        <AnalyticsScopeTabs
          basePath={basePath}
          currentScope={currentScope}
        />
      )}

      {showFilters && (
        <AnalyticsFilters
          basePath={basePath}
          currentScope={currentScope}
          currentStart={currentStart}
          currentEnd={currentEnd}
        />
      )}
    </div>
  )
}