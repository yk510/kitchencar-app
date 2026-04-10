import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// 0=月 〜 6=日
const DAY_LABELS = ['月', '火', '水', '木', '金', '土', '日']

export async function GET() {
  const { data: txns, error } = await supabase
    .from('transactions')
    .select('day_of_week, txn_date, total_amount')
    .eq('is_return', false)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: sales } = await supabase
    .from('product_sales')
    .select('txn_no, product_name, subtotal, quantity')

  // 取引Noと曜日のマッピング（product_salesに曜日がないため結合）
  const txnDayMap = new Map<string, number>()
  const dayTotals = Array.from({ length: 7 }, () => ({ total: 0, days: new Set<string>() }))

  for (const t of txns ?? []) {
    txnDayMap.set(t.txn_date + '_', t.day_of_week)  // 簡易マッピング
    const dow = t.day_of_week
    dayTotals[dow].total += t.total_amount
    dayTotals[dow].days.add(t.txn_date)
  }

  // 商品別TOP（曜日ごと）
  const dayProductMap: Map<number, Map<string, number>>[] = Array.from({ length: 7 }, () => new Map())
  for (const t of txns ?? []) {
    // txn_dateで曜日を特定するため、transactionsから直接集計
    const dowEntry = dayProductMap[t.day_of_week]
    // ここではトランザクションの合計のみ（商品別は別途集計）
  }

  const result = DAY_LABELS.map((label, dow) => {
    const entry = dayTotals[dow]
    const outDays = entry.days.size
    return {
      day_of_week:   dow,
      label,
      total_sales:   entry.total,
      out_days:      outDays,
      avg_sales:     outDays > 0 ? Math.round(entry.total / outDays) : 0,
    }
  })

  return NextResponse.json({ data: result })
}
