import { NextRequest, NextResponse } from 'next/server'
import { requireRouteSession } from '@/lib/auth'

// GET
export async function GET(req: NextRequest) {
  const auth = await requireRouteSession(req)
  if (auth.response) return auth.response
  const { supabase } = auth.session

  const { data, error } = await (supabase as any)
    .from('product_master')
    .select('*')
    .order('cost_amount', { ascending: true, nullsFirst: true })
    .order('product_name', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

// POST
export async function POST(req: NextRequest) {
  try {
    const auth = await requireRouteSession(req)
    if (auth.response) return auth.response
    const { supabase, user } = auth.session

    const { product_name, cost_amount, cost_rate } = await req.json()

    if (!product_name) {
      return NextResponse.json({ error: '商品名が必要です' }, { status: 400 })
    }
    if (cost_amount == null && cost_rate == null) {
      return NextResponse.json({ error: '原価額か原価率のどちらかを入力してください' }, { status: 400 })
    }

    const { data: current } = await (supabase as any)
      .from('product_master')
      .select('cost_amount, cost_rate')
      .eq('product_name', product_name)
      .single()

    const currentData = current as any

    if (currentData && (currentData.cost_amount != null || currentData.cost_rate != null)) {
      await (supabase as any).from('cost_history').insert({
        user_id: user.id,
        product_name,
        cost_amount: currentData.cost_amount,
        cost_rate:   currentData.cost_rate,
      })
    }

    const { error } = await (supabase as any)
      .from('product_master')
      .upsert(
        [{
          user_id: user.id,
          product_name,
          cost_amount:     cost_amount ?? null,
          cost_rate:       cost_rate   ?? null,
          cost_updated_at: new Date().toISOString(),
        }],
        { onConflict: 'user_id,product_name' }
      )

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: 'サーバーエラー' }, { status: 500 })
  }
}
