import { NextRequest, NextResponse } from 'next/server'
import { requireRouteSession } from '@/lib/auth'

export async function GET(req: NextRequest) {
  const auth = await requireRouteSession(req)
  if (auth.response) return auth.response
  const { supabase } = auth.session

  const { count: txnCount, error: txnErr } = await (supabase as any)
    .from('transactions')
    .select('*', { count: 'exact', head: true })

  const { count: salesCount, error: salesErr } = await (supabase as any)
    .from('product_sales')
    .select('*', { count: 'exact', head: true })

  const { count: productMasterCount, error: productErr } = await (supabase as any)
    .from('product_master')
    .select('*', { count: 'exact', head: true })

  return NextResponse.json({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    txnCount,
    salesCount,
    productMasterCount,
    txnErr,
    salesErr,
    productErr,
  })
}
