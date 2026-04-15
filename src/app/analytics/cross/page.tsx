import AnalyticsPageHeader from '@/components/AnalyticsPageHeader'
import CrossAnalyticsClient from '@/components/CrossAnalyticsClient'
import { requireServerSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function CrossAnalyticsPage() {
  await requireServerSession()

  return (
    <div>
      <AnalyticsPageHeader
        title="クロス分析"
        description="場所・曜日・天候・時間帯・商品をドラッグで組み合わせて、指標を自由に切り替えながら分析できます。"
        basePath="/analytics/cross"
        showScopeTabs={false}
        showFilters={false}
      />
      <CrossAnalyticsClient />
    </div>
  )
}
