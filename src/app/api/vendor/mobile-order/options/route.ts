import { NextRequest } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import { ensureVendorStoreResources } from '@/lib/mobile-order'
import type {
  MobileOrderOptionChoiceRow,
  MobileOrderOptionGroupRow,
  MobileOrderProductRow,
  VendorMobileOrderOptionGroup,
  VendorMobileOrderOptionGroupMutationPayload,
  VendorMobileOrderOptionsPayload,
} from '@/types/api-payloads'

type ChoiceInput = {
  name: string
  price_delta: number
  sort_order: number
  is_active: boolean
}

function normalizeBoolean(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback
}

function buildOptionGroupsPayload(args: {
  groups: MobileOrderOptionGroupRow[]
  choices: MobileOrderOptionChoiceRow[]
  links: Array<{ product_id: string; option_group_id: string }>
}): VendorMobileOrderOptionGroup[] {
  const choicesByGroup = new Map<string, MobileOrderOptionChoiceRow[]>()
  for (const choice of args.choices) {
    const current = choicesByGroup.get(choice.group_id) ?? []
    current.push(choice)
    choicesByGroup.set(choice.group_id, current)
  }

  const linkedProductIdsByGroup = new Map<string, string[]>()
  for (const link of args.links) {
    const current = linkedProductIdsByGroup.get(link.option_group_id) ?? []
    current.push(link.product_id)
    linkedProductIdsByGroup.set(link.option_group_id, current)
  }

  return args.groups.map((group) => ({
    ...group,
    choices: (choicesByGroup.get(group.id) ?? []).sort((a, b) => a.sort_order - b.sort_order),
    linked_product_ids: linkedProductIdsByGroup.get(group.id) ?? [],
  }))
}

async function loadOptionAdminData(supabase: any, storeId: string) {
  const [{ data: products, error: productsError }, { data: groups, error: groupsError }, { data: choices, error: choicesError }, { data: links, error: linksError }] =
    await Promise.all([
      supabase.from('mobile_order_products').select('*').eq('store_id', storeId).order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
      supabase.from('mobile_order_option_groups').select('*').eq('store_id', storeId).order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
      supabase
        .from('mobile_order_option_choices')
        .select('*, mobile_order_option_groups!inner(store_id)')
        .eq('mobile_order_option_groups.store_id', storeId)
        .order('sort_order', { ascending: true }),
      supabase
        .from('mobile_order_product_option_groups')
        .select('product_id, option_group_id, mobile_order_products!inner(store_id)')
        .eq('mobile_order_products.store_id', storeId),
    ])

  if (productsError) throw new Error(productsError.message)
  if (groupsError) throw new Error(groupsError.message)
  if (choicesError) throw new Error(choicesError.message)
  if (linksError) throw new Error(linksError.message)

  return {
    products: (products ?? []) as MobileOrderProductRow[],
    optionGroups: buildOptionGroupsPayload({
      groups: (groups ?? []) as MobileOrderOptionGroupRow[],
      choices: ((choices ?? []) as Array<MobileOrderOptionChoiceRow & { mobile_order_option_groups: { store_id: string } }>).map(
        ({ mobile_order_option_groups: _ignored, ...choice }) => choice
      ),
      links: ((links ?? []) as Array<{ product_id: string; option_group_id: string; mobile_order_products: { store_id: string } }>).map(
        ({ mobile_order_products: _ignored, ...link }) => link
      ),
    }),
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireRouteSession(req)
  if (auth.response) return auth.response

  if (auth.session.role !== 'vendor') {
    return apiError('ベンダー権限が必要です', 403)
  }

  const { supabase, user } = auth.session
  const { data: vendorProfile } = await (supabase as any)
    .from('vendor_profiles')
    .select('business_name')
    .eq('user_id', user.id)
    .maybeSingle()

  try {
    const { store } = await ensureVendorStoreResources(supabase, user, {
      businessName: vendorProfile?.business_name ?? null,
    })

    const payloadBase = await loadOptionAdminData(supabase, store.id)

    const payload: VendorMobileOrderOptionsPayload = {
      store,
      products: payloadBase.products,
      optionGroups: payloadBase.optionGroups,
    }

    return apiOk(payload)
  } catch (error) {
    console.error('[vendor/mobile-order/options GET]', error)
    return apiError(error instanceof Error ? error.message : 'サーバーエラー')
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRouteSession(req)
  if (auth.response) return auth.response

  if (auth.session.role !== 'vendor') {
    return apiError('ベンダー権限が必要です', 403)
  }

  const { supabase, user } = auth.session

  try {
    const body = await req.json()
    const name = String(body.name ?? '').trim()
    const selectionType = String(body.selection_type ?? '').trim()
    const isRequired = normalizeBoolean(body.is_required, false)
    const minSelect = body.min_select == null || body.min_select === '' ? null : Number(body.min_select)
    const maxSelect = body.max_select == null || body.max_select === '' ? null : Number(body.max_select)
    const sortOrder = Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 0
    const linkedProductIds = Array.isArray(body.linked_product_ids)
      ? body.linked_product_ids.map((value: unknown) => String(value))
      : []
    const choicesInput = Array.isArray(body.choices) ? body.choices : []

    if (!name) return apiError('オプショングループ名は必須です', 400)
    if (!['single', 'multiple'].includes(selectionType)) return apiError('選択方式が不正です', 400)
    if (!choicesInput.length) return apiError('選択肢を1件以上入力してください', 400)

    const normalizedChoices: ChoiceInput[] = choicesInput.map((choice: any, index: number) => ({
      name: String(choice?.name ?? '').trim(),
      price_delta: Number(choice?.price_delta ?? 0),
      sort_order: Number.isFinite(Number(choice?.sort_order)) ? Number(choice.sort_order) : index,
      is_active: normalizeBoolean(choice?.is_active, true),
    }))

    if (normalizedChoices.some((choice: ChoiceInput) => !choice.name)) {
      return apiError('選択肢名は必須です', 400)
    }

    const { data: vendorProfile } = await (supabase as any)
      .from('vendor_profiles')
      .select('business_name')
      .eq('user_id', user.id)
      .maybeSingle()

    const { store } = await ensureVendorStoreResources(supabase, user, {
      businessName: vendorProfile?.business_name ?? null,
    })

    const { data: group, error: groupError } = await (supabase as any)
      .from('mobile_order_option_groups')
      .insert([
        {
          store_id: store.id,
          name,
          is_required: isRequired,
          selection_type: selectionType,
          min_select: minSelect,
          max_select: maxSelect,
          sort_order: sortOrder,
        },
      ])
      .select('*')
      .single()

    if (groupError) return apiError(groupError.message)

    const { data: choices, error: choicesError } = await (supabase as any)
      .from('mobile_order_option_choices')
      .insert(
        normalizedChoices.map((choice) => ({
          group_id: group.id,
          name: choice.name,
          price_delta: choice.price_delta,
          sort_order: choice.sort_order,
          is_active: choice.is_active,
        }))
      )
      .select('*')

    if (choicesError) return apiError(choicesError.message)

    if (linkedProductIds.length > 0) {
      const { error: linkError } = await (supabase as any)
        .from('mobile_order_product_option_groups')
        .insert(
          linkedProductIds.map((productId: string, index: number) => ({
            product_id: productId,
            option_group_id: group.id,
            sort_order: index,
          }))
        )

      if (linkError) return apiError(linkError.message)
    }

    const payload: VendorMobileOrderOptionGroupMutationPayload = {
      ...(group as MobileOrderOptionGroupRow),
      choices: (choices ?? []) as MobileOrderOptionChoiceRow[],
      linked_product_ids: linkedProductIds,
    }

    return apiOk(payload)
  } catch (error) {
    console.error('[vendor/mobile-order/options POST]', error)
    return apiError('サーバーエラー')
  }
}
