export const dynamic = 'force-dynamic'

import DashboardClient from '@/components/DashboardClient'
import { requireServerSession } from '@/lib/auth'

type TaskTone = 'danger' | 'warn'

async function getDashboardData(supabase: any) {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())

  const monthStart = today.slice(0, 7) + '-01'

  const { data: todayTxns } = await (supabase as any)
    .from('transactions')
    .select('total_amount')
    .eq('txn_date', today)
    .eq('is_return', false)

  const { data: monthTxns } = await (supabase as any)
    .from('transactions')
    .select('txn_date, total_amount, location_id')
    .gte('txn_date', monthStart)
    .lte('txn_date', today)
    .eq('is_return', false)

  const { data: monthProducts } = await (supabase as any)
    .from('product_sales')
    .select('product_name, subtotal, quantity')
    .gte('txn_date', monthStart)
    .lte('txn_date', today)

  const { data: costs } = await (supabase as any)
    .from('product_master')
    .select('product_name, cost_amount')

  const { data: unregistered } = await (supabase as any)
    .from('product_master')
    .select('product_name')
    .is('cost_amount', null)
    .is('cost_rate', null)

  const { data: txnDates } = await (supabase as any)
    .from('transactions')
    .select('txn_date')
    .eq('is_return', false)

  const { data: logDates } = await (supabase as any)
    .from('stall_logs')
    .select('log_date')

  const { data: locations } = await (supabase as any)
    .from('locations')
    .select('id, name')

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

  const txnDateSet = new Set(((txnDates ?? []) as any[]).map((t: any) => t.txn_date))
  const logDateSet = new Set(((logDates ?? []) as any[]).map((l: any) => l.log_date))

  const unmatchedDates = Array.from(txnDateSet)
    .filter((d) => !logDateSet.has(d))
    .sort()

  const todayList = (todayTxns ?? []) as any[]
  const monthList = (monthTxns ?? []) as any[]
  const monthProductList = (monthProducts ?? []) as any[]

  const todaySales = todayList.reduce((s, t) => s + (t.total_amount ?? 0), 0)
  const monthSales = monthList.reduce((s, t) => s + (t.total_amount ?? 0), 0)

  const todayTxnCount = todayList.length
  const monthTxnCount = monthList.length
  const avgTicket = monthTxnCount > 0 ? Math.round(monthSales / monthTxnCount) : 0

  let monthEstimatedCost = 0
  for (const p of monthProductList) {
    const unitCost = costMap.get(p.product_name)
    if (unitCost != null) {
      monthEstimatedCost += unitCost * (p.quantity ?? 0)
    }
  }

  const monthGrossProfit = monthSales - monthEstimatedCost
  const monthGrossMargin =
    monthSales > 0 ? Math.round((monthGrossProfit / monthSales) * 1000) / 10 : 0

  const productMap = new Map<string, number>()
  for (const p of monthProductList) {
    productMap.set(
      p.product_name,
      (productMap.get(p.product_name) ?? 0) + (p.subtotal ?? 0)
    )
  }

  const top3 = Array.from(productMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)

  const dayMap = new Map<
    string,
    {
      total: number
      locations: Set<string>
    }
  >()

  for (const t of monthList) {
    const date = t.txn_date
    const entry = dayMap.get(date) ?? {
      total: 0,
      locations: new Set<string>(),
    }

    entry.total += t.total_amount ?? 0

    if (t.location_id) {
      const locationName = locationNameMap.get(t.location_id)
      if (locationName) {
        entry.locations.add(locationName)
      }
    }

    dayMap.set(date, entry)
  }

  const dayStats = Array.from(dayMap.entries())
    .map(([date, value]) => ({
      date,
      total: value.total,
      locationNames: Array.from(value.locations),
      locationLabel:
        value.locations.size === 0
          ? '未紐付け'
          : Array.from(value.locations).join(' / '),
    }))
    .sort((a, b) => b.total - a.total)

  const bestDay = dayStats[0] ?? null
  const worstDay = dayStats[dayStats.length - 1] ?? null

  const locationStatsMap = new Map<
    string,
    {
      name: string
      total: number
      days: Set<string>
    }
  >()

  for (const t of monthList) {
    const locationId = t.location_id ?? '__unlinked__'
    const locationName =
      t.location_id && locationNameMap.get(t.location_id)
        ? locationNameMap.get(t.location_id)!
        : '未紐付け'

    const entry = locationStatsMap.get(locationId) ?? {
      name: locationName,
      total: 0,
      days: new Set<string>(),
    }

    entry.total += t.total_amount ?? 0
    entry.days.add(t.txn_date)

    locationStatsMap.set(locationId, entry)
  }

  const locationStats = Array.from(locationStatsMap.entries())
    .map(([id, value]) => {
      const dayCount = value.days.size
      const avgSales = dayCount > 0 ? Math.round(value.total / dayCount) : 0

      return {
        id,
        name: value.name,
        total: value.total,
        dayCount,
        avgSales,
      }
    })
    .filter((row) => row.id !== '__unlinked__')
    .sort((a, b) => b.avgSales - a.avgSales)

  const bestLocation = locationStats[0] ?? null
  const worstLocation = locationStats[locationStats.length - 1] ?? null

  const tasks: { label: string; href: string; tone: TaskTone }[] = []

  if (unmatchedDates.length > 0) {
    tasks.push({
      label: `出店ログ未登録の日付を登録する（${unmatchedDates.length}日）`,
      href: '/stall-logs',
      tone: 'danger',
    })
  }

  if ((unregistered ?? []).length > 0) {
    tasks.push({
      label: `原価未登録の商品を登録する（${(unregistered ?? []).length}件）`,
      href: '/products/master',
      tone: 'warn',
    })
  }

  return {
    todaySales,
    monthSales,
    todayTxnCount,
    monthTxnCount,
    avgTicket,
    monthGrossProfit,
    monthGrossMargin,
    top3,
    unregisteredCount: (unregistered ?? []).length,
    unregisteredNames: ((unregistered ?? []) as any[]).map((u: any) => u.product_name),
    unmatchedDates,
    tasks,
    bestDay,
    worstDay,
    bestLocation,
    worstLocation,
  }
}

export default async function DashboardPage() {
  const { supabase } = await requireServerSession()
  const data = await getDashboardData(supabase)
  return <DashboardClient data={data} />
}
