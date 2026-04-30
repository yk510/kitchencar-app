import { NextRequest } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import type {
  MobileOrderOptionChoiceRow,
  MobileOrderOptionGroupRow,
  VendorMobileOrderOptionGroupMutationPayload,
} from '@/types/api-payloads'

function normalizeBoolean(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback
}

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
    const body = await req.json()

    const { data: currentGroup, error: currentGroupError } = await (supabase as any)
      .from('mobile_order_option_groups')
      .select('*, vendor_stores!inner(vendor_user_id)')
      .eq('id', id)
      .eq('vendor_stores.vendor_user_id', user.id)
      .single()

    if (currentGroupError || !currentGroup) {
      return apiError('対象のオプショングループが見つかりません', 404)
    }

    const name = typeof body.name === 'string' ? body.name.trim() : currentGroup.name
    const selectionType =
      typeof body.selection_type === 'string' ? body.selection_type.trim() : currentGroup.selection_type
    const isRequired = typeof body.is_required === 'boolean' ? body.is_required : currentGroup.is_required
    const minSelect = body.min_select === '' ? null : body.min_select != null ? Number(body.min_select) : currentGroup.min_select
    const maxSelect = body.max_select === '' ? null : body.max_select != null ? Number(body.max_select) : currentGroup.max_select
    const sortOrder = body.sort_order != null ? Number(body.sort_order) : currentGroup.sort_order
    const linkedProductIds = Array.isArray(body.linked_product_ids)
      ? body.linked_product_ids.map((value: unknown) => String(value))
      : null
    const choicesInput = Array.isArray(body.choices) ? body.choices : null

    if (!name) return apiError('オプショングループ名は必須です', 400)
    if (!['single', 'multiple'].includes(selectionType)) return apiError('選択方式が不正です', 400)
    if (choicesInput && choicesInput.length === 0) return apiError('選択肢を1件以上入力してください', 400)

    const normalizedChoices =
      choicesInput?.map((choice: any, index: number) => ({
        name: String(choice?.name ?? '').trim(),
        price_delta: Number(choice?.price_delta ?? 0),
        sort_order: Number.isFinite(Number(choice?.sort_order)) ? Number(choice.sort_order) : index,
        is_active: normalizeBoolean(choice?.is_active, true),
      })) ?? null

    if (normalizedChoices?.some((choice: { name: string }) => !choice.name)) {
      return apiError('選択肢名は必須です', 400)
    }

    const { data: updatedGroup, error: updateError } = await (supabase as any)
      .from('mobile_order_option_groups')
      .update({
        name,
        selection_type: selectionType,
        is_required: isRequired,
        min_select: minSelect,
        max_select: maxSelect,
        sort_order: sortOrder,
      })
      .eq('id', id)
      .select('*')
      .single()

    if (updateError) return apiError(updateError.message)

    if (normalizedChoices) {
      const { error: deleteChoicesError } = await (supabase as any)
        .from('mobile_order_option_choices')
        .delete()
        .eq('group_id', id)

      if (deleteChoicesError) return apiError(deleteChoicesError.message)

      const { error: insertChoicesError } = await (supabase as any)
        .from('mobile_order_option_choices')
        .insert(
          normalizedChoices.map((choice: { name: string; price_delta: number; sort_order: number; is_active: boolean }) => ({
            group_id: id,
            name: choice.name,
            price_delta: choice.price_delta,
            sort_order: choice.sort_order,
            is_active: choice.is_active,
          }))
        )

      if (insertChoicesError) return apiError(insertChoicesError.message)
    }

    if (linkedProductIds) {
      const { error: deleteLinksError } = await (supabase as any)
        .from('mobile_order_product_option_groups')
        .delete()
        .eq('option_group_id', id)

      if (deleteLinksError) return apiError(deleteLinksError.message)

      if (linkedProductIds.length > 0) {
        const { error: insertLinksError } = await (supabase as any)
          .from('mobile_order_product_option_groups')
          .insert(
            linkedProductIds.map((productId: string, index: number) => ({
              product_id: productId,
              option_group_id: id,
              sort_order: index,
            }))
          )

        if (insertLinksError) return apiError(insertLinksError.message)
      }
    }

    const [{ data: finalChoices, error: finalChoicesError }, { data: finalLinks, error: finalLinksError }] = await Promise.all([
      (supabase as any).from('mobile_order_option_choices').select('*').eq('group_id', id).order('sort_order', { ascending: true }),
      (supabase as any).from('mobile_order_product_option_groups').select('product_id').eq('option_group_id', id).order('sort_order', { ascending: true }),
    ])

    if (finalChoicesError) return apiError(finalChoicesError.message)
    if (finalLinksError) return apiError(finalLinksError.message)

    const payload: VendorMobileOrderOptionGroupMutationPayload = {
      ...(updatedGroup as MobileOrderOptionGroupRow),
      choices: (finalChoices ?? []) as MobileOrderOptionChoiceRow[],
      linked_product_ids: ((finalLinks ?? []) as Array<{ product_id: string }>).map((link) => link.product_id),
    }

    return apiOk(payload)
  } catch (error) {
    console.error('[vendor/mobile-order/options/:id PATCH]', error)
    return apiError('サーバーエラー')
  }
}
