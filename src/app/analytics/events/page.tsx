import { supabase } from '@/lib/supabase'
import AnalyticsPageHeader from '@/components/AnalyticsPageHeader'

export const dynamic = 'force-dynamic'

async function getEventAnalytics(start?: string, end?: string) {
  let eventsQuery = (supabase as any)
    .from('events')
    .select('id, event_name, event_date, location_id')

  if (start) eventsQuery = eventsQuery.gte('event_date', start)
  if (end) eventsQuery = eventsQuery.lte('event_date', end)

  const { data: events, error: eventsErr } = await eventsQuery
  if (eventsErr) throw new Error(eventsErr.message)

  const { data: locations, error: locationsErr } = await (supabase as any)
    .from('locations')
    .select('id, name')
  if (locationsErr) throw new Error(locationsErr.message)

  let txnsQuery = (supabase as any)
    .from('transactions')
    .select('event_id, total_amount, txn_date, txn_no')
    .eq('is_return', false)
    .not('event_id', 'is', null)

  if (start) txnsQuery = txnsQuery.gte('txn_date', start)
  if (end) txnsQuery = txnsQuery.lte('txn_date', end)

  const { data: txns, error: txnsErr } = await txnsQuery
  if (txnsErr) throw new Error(txnsErr.message)

  let salesQuery = (supabase as any)
    .from('product_sales')
    .select('event_id, product_name, quantity, txn_date')
    .not('event_id', 'is', null)

  if (start) salesQuery = salesQuery.gte('txn_date', start)
  if (end) salesQuery = salesQuery.lte('txn_date', end)

  const { data: sales, error: salesErr } = await salesQuery
  if (salesErr) throw new Error(salesErr.message)

  const { data: costs, error: costsErr } = await (supabase as any)
    .from('product_master')
    .select('product_name, cost_amount')
  if (costsErr) throw new Error(costsErr.message)

  const locationNameMap = new Map<string, string>()
  for (const loc of ((locations ?? []) as any[])) {
    locationNameMap.set(loc.id, loc.name)
  }

  const costMap = new Map<string, number>()
  for (const c of ((costs ?? []) as any[])) {
    if (c.cost_amount != null) {
      costMap.set(c.product_name, c.cost_amount)
    }
  }

  const eventMap = new Map<
    string,
    {
      id: string
      event_name: string
      event_date: string | null
      location_name: string
      total_sales: number
      total_cost: number
      txnSet: Set<string>
    }
  >()

  for (const ev of ((events ?? []) as any[])) {
    eventMap.set(ev.id, {
      id: ev.id,
      event_name: ev.event_name,
      event_date: ev.event_date,
      location_name: ev.location_id ? locationNameMap.get(ev.location_id) ?? '-' : '-',
      total_sales: 0,
      total_cost: 0,
      txnSet: new Set(),
    })
  }

  for (const txn of ((txns ?? []) as any[])) {
    if (!txn.event_id) continue
    const entry = eventMap.get(txn.event_id)
    if (!entry) continue

    entry.total_sales += txn.total_amount ?? 0
    if (txn.txn_no) entry.txnSet.add(txn.txn_no)
  }

  for (const s of ((sales ?? []) as any[])) {
    if (!s.event_id) continue
    const entry = eventMap.get(s.event_id)
    if (!entry) continue

    const unitCost = costMap.get(s.product_name)
    if (unitCost != null) {
      entry.total_cost += unitCost * (s.quantity ?? 0)
    }
  }

  return Array.from(eventMap.values())
    .filter((row) => row.txnSet.size > 0)
    .map((row) => {
      const txnCount = row.txnSet.size
      return {
        ...row,
        txn_count: txnCount,
        avg_sales_per_txn: txnCount > 0 ? Math.round(row.total_sales / txnCount) : 0,
        gross_profit: row.total_sales - row.total_cost,
      }
    })
    .sort((a, b) => b.total_sales - a.total_sales)
}

function fmtYen(n: number) {
  return n.toLocaleString('ja-JP') + ' 円'
}

export default async function EventAnalyticsPage({
  searchParams,
}: {
  searchParams?: { start?: string; end?: string }
}) {
  const start = searchParams?.start
  const end = searchParams?.end

  const data = await getEventAnalytics(start, end)

  return (
    <div>
      <AnalyticsPageHeader
        title="イベント別分析"
        description="出店ログでイベント名が入力されたデータのみを集計しています。"
        basePath="/analytics/events"
        currentStart={start}
        currentEnd={end}
        showScopeTabs={false}
      />

      {data.length === 0 ? (
        <div className="soft-panel text-center py-20">
          <p className="section-subtitle">この条件に一致するイベントデータがありません。</p>
          <p className="text-sm text-sub mt-2">出店ログ登録時にイベント名を入力してください。</p>
        </div>
      ) : (
        <div className="space-y-4">
          {data.map((row) => (
            <div key={row.id} className="soft-card p-5 bg-pink-50 border-pink-200">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">🎪</span>
                    <span className="badge-soft badge-pink">イベント</span>
                  </div>
                  <h2 className="text-lg font-semibold text-main">{row.event_name}</h2>
                  <p className="text-xs text-sub mt-1">
                    開催日: {row.event_date ?? '-'} / 場所: {row.location_name}
                  </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-right">
                  <div className="rounded-2xl bg-white/70 border border-white p-3">
                    <p className="text-xs text-sub">取引数</p>
                    <p className="font-bold text-main">{row.txn_count} 件</p>
                  </div>
                  <div className="rounded-2xl bg-white/70 border border-white p-3">
                    <p className="text-xs text-sub">平均取引単価</p>
                    <p className="font-bold text-blue-700">{fmtYen(row.avg_sales_per_txn)}</p>
                  </div>
                  <div className="rounded-2xl bg-white/70 border border-white p-3">
                    <p className="text-xs text-sub">累計売上</p>
                    <p className="font-bold text-main">{fmtYen(row.total_sales)}</p>
                  </div>
                  <div className="rounded-2xl bg-white/70 border border-white p-3">
                    <p className="text-xs text-sub">推定粗利</p>
                    <p className={`font-bold ${row.gross_profit >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      {fmtYen(row.gross_profit)}
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