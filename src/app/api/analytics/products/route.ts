import { NextRequest, NextResponse } from 'next/server'
import { requireRouteSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = await requireRouteSession(req)
  if (auth.response) return auth.response
  const { supabase } = auth.session

  // 商品別売上集計
  const { data: sales, error: saleErr } = await (supabase as any)
    .from('product_sales')
    .select('product_name, unit_price, quantity, subtotal')

  if (saleErr) return NextResponse.json({ error: saleErr.message }, { status: 500 })

  // 原価マスタ
  const { data: costs } = await (supabase as any)
    .from('product_master')
    .select('product_name, cost_amount, cost_rate')

  const costMap = new Map<string, { cost_amount: number | null; cost_rate: number | null }>()
  for (const c of ((costs ?? []) as any[])) {
    costMap.set(c.product_name, { cost_amount: c.cost_amount, cost_rate: c.cost_rate })
  }

  // 商品ごとに集計
  const productMap = new Map<string, {
    total_sales: number
    total_qty: number
    total_cost: number
    has_cost: boolean
  }>()

  for (const s of ((sales ?? []) as any[])) {
    const entry = productMap.get(s.product_name) ?? {
      total_sales: 0, total_qty: 0, total_cost: 0, has_cost: false,
    }
    entry.total_sales += s.subtotal
    entry.total_qty += s.quantity

    const costInfo = costMap.get(s.product_name)
    if (costInfo) {
      if (costInfo.cost_amount != null) {
        entry.total_cost += costInfo.cost_amount * s.quantity
        entry.has_cost = true
      } else if (costInfo.cost_rate != null) {
        entry.total_cost += (s.subtotal * costInfo.cost_rate) / 100
        entry.has_cost = true
      }
    }
    productMap.set(s.product_name, entry)
  }

  // ソート（売上降順）して利益率計算
  const sorted = Array.from(productMap.entries())
    .sort((a, b) => b[1].total_sales - a[1].total_sales)

  const result = sorted.map(([name, e], i) => {
    const avgPrice = e.total_qty > 0 ? Math.round(e.total_sales / e.total_qty) : 0
    const profit = e.has_cost ? e.total_sales - e.total_cost : null
    const profitRate = e.has_cost && e.total_sales > 0
      ? Math.round(((e.total_sales - e.total_cost) / e.total_sales) * 100)
      : null
    const costInfo = costMap.get(name)

    return {
      product_name: name,
      total_sales: e.total_sales,
      total_qty: e.total_qty,
      avg_price: avgPrice,
      cost_amount: costInfo?.cost_amount ?? null,
      cost_rate_reg: costInfo?.cost_rate ?? null,
      profit,
      profit_rate: profitRate,
      has_cost: e.has_cost,
      is_top3: i < 3,
      is_low_margin: profitRate != null && profitRate < 50,
    }
  })

  return NextResponse.json({ data: result })
}
