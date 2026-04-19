import { NextRequest } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'

export async function GET(req: NextRequest) {
  const auth = await requireRouteSession(req)
  if (auth.response) return auth.response
  const { supabase } = auth.session

  const { data, error } = await (supabase as any)
    .from('product_master')
    .select('product_name, created_at')
    .is('cost_amount', null)
    .is('cost_rate', null)
    .order('created_at', { ascending: false })

  if (error) return apiError(error.message)
  return apiOk({
    items: data ?? [],
    count: data?.length ?? 0,
  })
}
