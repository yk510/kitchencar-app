import { supabase } from '@/lib/supabase'
import AnalyticsPageHeader from '@/components/AnalyticsPageHeader'
import { AnalyticsScope } from '@/components/AnalyticsScopeTabs'

export const dynamic = 'force-dynamic'

function normalizeScope(scope?: string): AnalyticsScope {
  if (scope === 'normal') return 'normal'
  if (scope === 'event') return 'event'
  return 'all'
}

async function getProductAnalytics(
  scope: AnalyticsScope,
  start?: string,
  end?: string
) {
  let salesQuery = (supabase as any)
    .from('product_sales')
    .select('product_name, subtotal, quantity, txn_no, event_id, txn_date')

  if (scope === 'normal') {
    salesQuery = salesQuery.is('event_id', null)
  } else if (scope === 'event') {
    salesQuery = salesQuery.not('event_id', 'is', null)
  }

  if (start) {
    salesQuery = salesQuery.gte('txn_date', start)
  }
  if (end) {
    salesQuery = salesQuery.lte('txn_date', end)
  }

  const { data: sales, error: salesErr } = await salesQuery

  if (salesErr) {
    throw new Error(salesErr.message)
  }

  const { data: costs, error: costsErr } = await (supabase as any)
    .from('product_master')
    .select('product_name, cost_amount')

  if (costsErr) {
    throw new Error(costsErr.message)
  }

  const costMap = new Map<string, number>()
  for (const c of ((costs ?? []) as any[])) {
    if (c.cost_amount != null) {
      costMap.set(c.product_name, c.cost_amount)
    }
  }

  const productMap = new Map<
    string,
    {
      totalSales: number
      totalQty: number
      txnSet: Set<string>
      totalCost: number
    }
  >()

  for (const s of ((sales ?? []) as any[])) {
    const name = s.product_name
    if (!name) continue

    const entry = productMap.get(name) ?? {
      totalSales: 0,
      totalQty: 0,
      txnSet: new Set<string>(),
      totalCost: 0,
    }

    entry.totalSales += s.subtotal ?? 0
    entry.totalQty += s.quantity ?? 0

    if (s.txn_no) {
      entry.txnSet.add(s.txn_no)
    }

    const unitCost = costMap.get(name)
    if (unitCost != null) {
      entry.totalCost += unitCost * (s.quantity ?? 0)
    }

    productMap.set(name, entry)
  }

  const rows = Array.from(productMap.entries())
    .map(([product_name, value]) => {
      const txnCount = value.txnSet.size
      const avgSalesPerTxn =
        txnCount > 0 ? Math.round(value.totalSales / txnCount) : 0

      return {
        product_name,
        total_sales: value.totalSales,
        total_qty: value.totalQty,
        txn_count: txnCount,
        avg_sales_per_txn: avgSalesPerTxn,
        profit: value.totalSales - value.totalCost,
      }
    })
    .sort((a, b) => b.total_sales - a.total_sales)

  return rows
}

export default async function ProductAnalyticsPage({
  searchParams,
}: {
  searchParams?: { scope?: string; start?: string; end?: string }
}) {
  const scope = normalizeScope(searchParams?.scope)
  const start = searchParams?.start
  const end = searchParams?.end

  const data = await getProductAnalytics(scope, start, end)

  const scopeLabel =
    scope === 'normal'
      ? '通常出店のみ'
      : scope === 'event'
      ? 'イベント出店のみ'
      : '全体'

  return (
    <div>
      <AnalyticsPageHeader
        title="商品別分析"
        description="商品ごとの売上・販売数量・利益感を表示します。"
        scopeLabel={scopeLabel}
        basePath="/analytics/products"
        currentScope={scope}
        currentStart={start}
        currentEnd={end}
      />

      {data.length === 0 ? (
  <div className="soft-panel text-center py-20">
    <p className="section-subtitle">この条件に一致するデータがありません。</p>
  </div>
) : (
  <div className="space-y-4">
    {data.map((row, i) => (
      <div
        key={row.product_name}
        className="soft-card p-5 bg-white"
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-orange-50 border border-orange-200 text-sm font-bold text-orange-700">
                {i + 1}
              </span>
              <span className="text-lg">🥤</span>
            </div>
            <h2 className="text-lg font-semibold text-main">{row.product_name}</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-right">
            <div className="rounded-2xl bg-[#fffdf9] border border-soft p-3">
              <p className="text-xs text-sub">販売数量</p>
              <p className="font-bold text-main">{row.total_qty} 個</p>
            </div>
            <div className="rounded-2xl bg-[#fffdf9] border border-soft p-3">
              <p className="text-xs text-sub">取引件数</p>
              <p className="font-bold text-main">{row.txn_count} 件</p>
            </div>
            <div className="rounded-2xl bg-[#fffdf9] border border-soft p-3">
              <p className="text-xs text-sub">累計売上</p>
              <p className="font-bold text-blue-700">
                {row.total_sales.toLocaleString()} 円
              </p>
            </div>
            <div className="rounded-2xl bg-[#fffdf9] border border-soft p-3">
              <p className="text-xs text-sub">平均売上 / 取引</p>
              <p className="font-bold text-main">
                {row.avg_sales_per_txn.toLocaleString()} 円
              </p>
            </div>
            <div className="rounded-2xl bg-[#fffdf9] border border-soft p-3">
              <p className="text-xs text-sub">推定利益</p>
              <p
                className={`font-bold ${
                  row.profit >= 0 ? 'text-green-700' : 'text-red-600'
                }`}
              >
                {row.profit.toLocaleString()} 円
              </p>
            </div>
          </div>
        </div>
      </div>
    ))}
  </div>
)}
    </div>
  )
}