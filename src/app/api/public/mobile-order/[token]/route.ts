import { NextRequest } from 'next/server'
import { apiError, apiOk } from '@/lib/api-response'
import {
  getInventoryStatus,
  loadOrderedQuantityByProductForSchedule,
  loadScheduleInventoryState,
  resolveActiveSchedule,
} from '@/lib/mobile-order'
import { createServerSupabaseClient } from '@/lib/supabase'
import type {
  MobileOrderOptionChoiceRow,
  MobileOrderOptionGroupRow,
  MobileOrderProductRow,
  PublicMobileOrderOptionGroup,
  PublicMobileOrderPagePayload,
  StoreOrderScheduleRow,
} from '@/types/api-payloads'

function resolveSchedules(schedules: StoreOrderScheduleRow[]) {
  const now = Date.now()
  const sorted = [...schedules].sort((a, b) => new Date(a.opens_at).getTime() - new Date(b.opens_at).getTime())
  const activeSchedule = resolveActiveSchedule(sorted)
  const nextSchedule =
    sorted.find((schedule) => {
      if (schedule.status === 'cancelled') return false
      return new Date(schedule.opens_at).getTime() > now
    }) ?? null

  return { activeSchedule, nextSchedule }
}

function buildProducts(args: {
  products: MobileOrderProductRow[]
  optionGroups: MobileOrderOptionGroupRow[]
  optionChoices: MobileOrderOptionChoiceRow[]
  links: Array<{ product_id: string; option_group_id: string }>
  orderedQuantityByProduct: Map<string, number>
  inventoryByProduct: Map<string, { id: string; product_id: string; initial_quantity: number }>
  adjustmentsByProduct: Map<string, Array<{ adjustment_quantity: number }>>
}) {
  const choicesByGroup = new Map<string, MobileOrderOptionChoiceRow[]>()
  for (const choice of args.optionChoices) {
    const current = choicesByGroup.get(choice.group_id) ?? []
    current.push(choice)
    choicesByGroup.set(choice.group_id, current)
  }

  const groupsById = new Map<string, PublicMobileOrderOptionGroup>(
    args.optionGroups.map((group) => [
      group.id,
      {
        ...group,
        choices: (choicesByGroup.get(group.id) ?? []).sort((a, b) => a.sort_order - b.sort_order),
      },
    ])
  )

  const groupIdsByProduct = new Map<string, string[]>()
  for (const link of args.links) {
    const current = groupIdsByProduct.get(link.product_id) ?? []
    current.push(link.option_group_id)
    groupIdsByProduct.set(link.product_id, current)
  }

  return args.products.map((product) => {
    const currentInventory = args.inventoryByProduct.get(product.id) ?? null
    const currentAdjustments = args.adjustmentsByProduct.get(product.id) ?? []
    const adjustmentTotal = currentAdjustments.reduce((sum, adjustment) => sum + Number(adjustment.adjustment_quantity ?? 0), 0)
    const inventory = getInventoryStatus({
      tracks_inventory: product.tracks_inventory,
      initial_quantity: currentInventory?.initial_quantity ?? null,
      adjustment_total: adjustmentTotal,
      low_stock_threshold: product.low_stock_threshold,
      ordered_quantity: args.orderedQuantityByProduct.get(product.id) ?? 0,
      is_sold_out: product.is_sold_out,
    })

    return {
      ...product,
      current_schedule_inventory_id: currentInventory?.id ?? null,
      current_initial_quantity: currentInventory?.initial_quantity ?? null,
      current_adjustment_total: adjustmentTotal,
      current_available_quantity: inventory.availableQuantity,
      current_ordered_quantity: args.orderedQuantityByProduct.get(product.id) ?? 0,
      current_remaining_quantity: inventory.remainingQuantity,
      current_inventory_status: inventory.status,
      option_groups: (groupIdsByProduct.get(product.id) ?? [])
        .map((groupId) => groupsById.get(groupId))
        .filter(Boolean)
        .sort((a, b) => (a?.sort_order ?? 0) - (b?.sort_order ?? 0)) as PublicMobileOrderOptionGroup[],
    }
  })
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params
  const supabase = createServerSupabaseClient()

  const { data: orderPage, error: pageError } = await (supabase as any)
    .from('store_order_pages')
    .select('*, vendor_stores!inner(*)')
    .eq('public_token', token)
    .eq('status', 'published')
    .maybeSingle()

  if (pageError) {
    return apiError(pageError.message)
  }

  if (!orderPage?.vendor_stores) {
    return apiError('注文ページが見つかりません', 404)
  }

  const store = orderPage.vendor_stores

  const [{ data: schedules, error: schedulesError }, { data: products, error: productsError }, { data: optionGroups, error: groupsError }, { data: optionChoices, error: choicesError }, { data: links, error: linksError }] =
    await Promise.all([
      (supabase as any)
        .from('store_order_schedules')
        .select('*')
        .eq('order_page_id', orderPage.id)
        .order('business_date', { ascending: true })
        .order('opens_at', { ascending: true }),
      (supabase as any)
        .from('mobile_order_products')
        .select('*')
        .eq('store_id', store.id)
        .eq('is_published', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      (supabase as any)
        .from('mobile_order_option_groups')
        .select('*')
        .eq('store_id', store.id)
        .order('sort_order', { ascending: true }),
      (supabase as any)
        .from('mobile_order_option_choices')
        .select('*, mobile_order_option_groups!inner(store_id)')
        .eq('mobile_order_option_groups.store_id', store.id)
        .order('sort_order', { ascending: true }),
      (supabase as any)
        .from('mobile_order_product_option_groups')
        .select('product_id, option_group_id, mobile_order_products!inner(store_id)')
        .eq('mobile_order_products.store_id', store.id)
        .order('sort_order', { ascending: true }),
    ])

  if (schedulesError) return apiError(schedulesError.message)
  if (productsError) return apiError(productsError.message)
  if (groupsError) return apiError(groupsError.message)
  if (choicesError) return apiError(choicesError.message)
  if (linksError) return apiError(linksError.message)

  const resolvedSchedules = resolveSchedules((schedules ?? []) as StoreOrderScheduleRow[])
  const orderedQuantityByProduct = resolvedSchedules.activeSchedule
    ? await loadOrderedQuantityByProductForSchedule(supabase, resolvedSchedules.activeSchedule.id)
    : new Map<string, number>()
  const { inventoryByProduct, adjustmentsByProduct } = resolvedSchedules.activeSchedule
    ? await loadScheduleInventoryState(
        supabase,
        resolvedSchedules.activeSchedule.id,
        ((products ?? []) as Array<{ id: string }>).map((product) => product.id)
      )
    : { inventoryByProduct: new Map(), adjustmentsByProduct: new Map() }
  const publishedProducts = (products ?? []) as MobileOrderProductRow[]
  const visibleProducts = publishedProducts.filter((product) => product.is_published)

  const payload: PublicMobileOrderPagePayload = {
    store,
    orderPage: {
      id: orderPage.id,
      store_id: orderPage.store_id,
      page_title: orderPage.page_title,
      public_token: orderPage.public_token,
      status: orderPage.status,
      is_primary: orderPage.is_primary,
      notes: orderPage.notes,
      created_at: orderPage.created_at,
      updated_at: orderPage.updated_at,
    },
    activeSchedule: resolvedSchedules.activeSchedule,
    nextSchedule: resolvedSchedules.nextSchedule,
    products: buildProducts({
      products: visibleProducts,
      optionGroups: (optionGroups ?? []) as MobileOrderOptionGroupRow[],
      optionChoices: ((optionChoices ?? []) as Array<MobileOrderOptionChoiceRow & { mobile_order_option_groups: { store_id: string } }>).map(
        ({ mobile_order_option_groups: _ignored, ...choice }) => choice
      ),
      links: ((links ?? []) as Array<{ product_id: string; option_group_id: string; mobile_order_products: { store_id: string } }>).map(
        ({ mobile_order_products: _ignored, ...link }) => link
      ),
      orderedQuantityByProduct,
      inventoryByProduct,
      adjustmentsByProduct,
    }),
  }

  return apiOk(payload)
}
