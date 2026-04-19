import { NextRequest } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'

// 0=月 〜 6=日
const DAY_LABELS = ['月', '火', '水', '木', '金', '土', '日']

export async function GET(req: NextRequest) {
  const auth = await requireRouteSession(req)
  if (auth.response) return auth.response
  const { supabase } = auth.session

  const { data: txns, error } = await (supabase as any)
    .from('transactions')
    .select('day_of_week, txn_date, total_amount')
    .eq('is_return', false)

  if (error) return apiError(error.message)

  const { data: sales } = await (supabase as any)
    .from('product_sales')
    .select('txn_no, product_name, subtotal, quantity')

  const txnDayMap = new Map<string, number>()
  const dayTotals = Array.from({ length: 7 }, () => ({ total: 0, days: new Set<string>() }))

  for (const t of ((txns ?? []) as any[])) {
    txnDayMap.set(t.txn_date + '_', t.day_of_week)
    const dow = t.day_of_week
    dayTotals[dow].total += t.total_amount
    dayTotals[dow].days.add(t.txn_date)
  }

  const dayProductMap: Map<number, Map<string, number>>[] = Array.from({ length: 7 }, () => new Map())

  for (const t of ((txns ?? []) as any[])) {
    const dowEntry = dayProductMap[t.day_of_week]
    // 未使用ロジック
  }

  const result = DAY_LABELS.map((label, dow) => {
    const entry = dayTotals[dow]
    const outDays = entry.days.size
    return {
      day_of_week: dow,
      label,
      total_sales: entry.total,
      out_days: outDays,
      avg_sales: outDays > 0 ? Math.round(entry.total / outDays) : 0,
    }
  })

  return apiOk(result)
}
