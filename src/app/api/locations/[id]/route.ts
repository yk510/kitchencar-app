import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// PUT: 場所情報更新
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { name, address } = await req.json()

  const { error } = await (supabase as any)
    .from('locations')
    .update({ name, address })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// DELETE: 場所削除
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { error } = await (supabase as any)
    .from('locations')
    .delete()
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}