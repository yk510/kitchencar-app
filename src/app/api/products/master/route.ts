import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET: 原価マスタ一覧（未登録を先頭に）
export async function GET() {
  const { data, error } = await supabase
    .from('product_master')
    .select('*')
    .order('cost_amount', { ascending: true, nullsFirst: true })
    .order('product_name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// POST: 原価を登録・更新
export async function POST(req: NextRequest) {
  try {
    const { product_name, cost_amount, cost_rate } = await req.json()

    if (!product_name) {
      return NextResponse.json({ error: '商品名が必要です' }, { status: 400 })
    }
    if (cost_amount == null && cost_rate == null) {
      return NextResponse.json({ error: '原価額か原価率のどちらかを入力してください' }, { status: 400 })
    }

    // 現在の値を履歴に保存
    const { data: current } = await supabase
      .from('product_master')
      .select('cost_amount, cost_rate')
      .eq('product_name', product_name)
      .single()

    if (current && (current.cost_amount != null || current.cost_rate != null)) {
      await supabase.from('cost_history').insert({
        product_name,
        cost_amount: current.cost_amount,
        cost_rate:   current.cost_rate,
      })
    }

    // 原価を更新（原価率が入力された場合は保存して、計算は UI 側で行う）
    const { error } = await supabase
      .from('product_master')
      .upsert(
        {
          product_name,
          cost_amount:     cost_amount ?? null,
          cost_rate:       cost_rate   ?? null,
          cost_updated_at: new Date().toISOString(),
        },
        { onConflict: 'product_name' }
      )

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
