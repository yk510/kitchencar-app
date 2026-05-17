import { NextRequest } from 'next/server'
import {
  executeVendorMobileOrderJsonRoute,
} from '@/lib/vendor-mobile-order-route'
import {
  loadVendorOwnedOptionGroup,
  parseOptionGroupInput,
  updateVendorOptionGroup,
} from '@/lib/vendor-mobile-order-options-admin'

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  return executeVendorMobileOrderJsonRoute<Record<string, unknown>, unknown>(
    req,
    '[vendor/mobile-order/options/:id PATCH]',
    async ({ supabase, user }, rawBody) => {
      const currentGroup = await loadVendorOwnedOptionGroup(supabase, user.id, id)
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
      return updateVendorOptionGroup(supabase, id, input)
    },
    {
      notFound: ['対象のオプショングループが見つかりません'],
      badRequest: [
        'オプショングループ名は必須です',
        '選択方式が不正です',
        '選択肢を1件以上入力してください',
        '選択肢名は必須です',
      ],
    }
  )
}
