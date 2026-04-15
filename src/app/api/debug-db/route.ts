import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
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
