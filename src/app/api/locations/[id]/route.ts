import { NextRequest } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import type { MutationSuccessPayload } from '@/types/api-payloads'

// PUT: 場所情報更新
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireRouteSession(req)
  if (auth.response) return auth.response
  const { supabase } = auth.session

  const { name, address } = await req.json()

  const { error } = await (supabase as any)
    .from('locations')
    .update({ name, address })
    .eq('id', params.id)

  if (error) return apiError(error.message)
  const payload: MutationSuccessPayload = { success: true }
  return apiOk(payload)
}

// DELETE: 場所削除
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireRouteSession(req)
  if (auth.response) return auth.response
  const { supabase } = auth.session

  const { error } = await (supabase as any)
    .from('locations')
    .delete()
    .eq('id', params.id)

  if (error) return apiError(error.message)
  const payload: MutationSuccessPayload = { success: true }
  return apiOk(payload)
}
