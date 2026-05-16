import { NextRequest } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import {
  loadVendorOwnedOptionGroup,
  parseOptionGroupInput,
  updateVendorOptionGroup,
} from '@/lib/vendor-mobile-order-options-admin'

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireRouteSession(req)
  if (auth.response) return auth.response

  if (auth.session.role !== 'vendor') {
    return apiError('ベンダー権限が必要です', 403)
  }

  const { id } = await context.params
  const { supabase, user } = auth.session

  try {
    const currentGroup = await loadVendorOwnedOptionGroup(supabase, user.id, id)
    const rawBody = await req.json()
    const input = parseOptionGroupInput(
      {
        ...rawBody,
        name: typeof rawBody.name === 'string' ? rawBody.name : currentGroup.name,
        selection_type: typeof rawBody.selection_type === 'string' ? rawBody.selection_type : currentGroup.selection_type,
        is_required: typeof rawBody.is_required === 'boolean' ? rawBody.is_required : currentGroup.is_required,
        min_select: rawBody.min_select != null ? rawBody.min_select : currentGroup.min_select,
        max_select: rawBody.max_select != null ? rawBody.max_select : currentGroup.max_select,
        sort_order: rawBody.sort_order != null ? rawBody.sort_order : currentGroup.sort_order,
      },
      'update'
    )
    return apiOk(await updateVendorOptionGroup(supabase, id, input))
  } catch (error) {
    console.error('[vendor/mobile-order/options/:id PATCH]', error)
    const message = error instanceof Error ? error.message : 'サーバーエラー'
    if (message === '対象のオプショングループが見つかりません') {
      return apiError(message, 404)
    }
    if (
      message === 'オプショングループ名は必須です' ||
      message === '選択方式が不正です' ||
      message === '選択肢を1件以上入力してください' ||
      message === '選択肢名は必須です'
    ) {
      return apiError(message, 400)
    }
    return apiError(message)
  }
}
