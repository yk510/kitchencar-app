import {
  loadOrderedQuantityByProductForSchedule,
  loadScheduleInventoryState,
  resolveActiveSchedule,
} from '@/lib/mobile-order'
import { applyStorePosSettingsToStore } from '@/lib/store-pos-settings'
import {
  applyInventorySnapshotToPayload,
  buildPublicMobileOrderBasePayload,
  buildPublicMobileOrderInventorySnapshot,
} from '@/lib/public-mobile-order-payload'
import type {
  MobileOrderOptionChoiceRow,
  MobileOrderOptionGroupRow,
  MobileOrderProductRow,
  PublicMobileOrderInventorySnapshot,
  PublicMobileOrderPagePayload,
  StoreOrderScheduleRow,
} from '@/types/api-payloads'

export { applyInventorySnapshotToPayload } from '@/lib/public-mobile-order-payload'

type PublishedOrderResources = {
  store: PublicMobileOrderPagePayload['store']
  orderPage: PublicMobileOrderPagePayload['orderPage']
  schedules: StoreOrderScheduleRow[]
  products: MobileOrderProductRow[]
  optionGroups: MobileOrderOptionGroupRow[]
  optionChoices: MobileOrderOptionChoiceRow[]
  links: Array<{ product_id: string; option_group_id: string }>
}

export function resolvePublicOrderSchedules(schedules: StoreOrderScheduleRow[]) {
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

export async function loadPublishedOrderResources(
  supabase: any,
  token: string,
  options?: { applyStorePosSettings?: boolean }
): Promise<PublishedOrderResources | null> {
  const { data: orderPage, error: pageError } = await (supabase as any)
    .from('store_order_pages')
    .select('*, vendor_stores!inner(*)')
    .eq('public_token', token)
    .eq('status', 'published')
    .maybeSingle()

  if (pageError) {
    throw new Error(pageError.message)
  }

  if (!orderPage?.vendor_stores) {
    return null
  }

  const store = options?.applyStorePosSettings
    ? applyStorePosSettingsToStore(orderPage.vendor_stores, orderPage)
    : orderPage.vendor_stores

  const [
    { data: schedules, error: schedulesError },
    { data: products, error: productsError },
    { data: optionGroups, error: groupsError },
    { data: optionChoices, error: choicesError },
    { data: links, error: linksError },
  ] = await Promise.all([
    (supabase as any)
      .from('store_order_schedules')
      .select('*')
      .eq('store_id', store.id)
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

  if (schedulesError) throw new Error(schedulesError.message)
  if (productsError) throw new Error(productsError.message)
  if (groupsError) throw new Error(groupsError.message)
  if (choicesError) throw new Error(choicesError.message)
  if (linksError) throw new Error(linksError.message)

  return {
    store,
    orderPage,
    schedules: (schedules ?? []) as StoreOrderScheduleRow[],
    products: ((products ?? []) as MobileOrderProductRow[]).filter((product) => product.is_published),
    optionGroups: (optionGroups ?? []) as MobileOrderOptionGroupRow[],
    optionChoices: (
      (optionChoices ?? []) as Array<MobileOrderOptionChoiceRow & { mobile_order_option_groups: { store_id: string } }>
    ).map(({ mobile_order_option_groups: _ignored, ...choice }) => choice),
    links: (
      (links ?? []) as Array<{
        product_id: string
        option_group_id: string
        mobile_order_products: { store_id: string }
      }>
    ).map(({ mobile_order_products: _ignored, ...link }) => link),
  }
}

export async function loadPublicMobileOrderBasePayload(
  supabase: any,
  token: string,
  options?: { applyStorePosSettings?: boolean }
): Promise<PublicMobileOrderPagePayload | null> {
  const resources = await loadPublishedOrderResources(supabase, token, options)
  if (!resources) return null

  const resolvedSchedules = resolvePublicOrderSchedules(resources.schedules)

  return buildPublicMobileOrderBasePayload({
    store: resources.store,
    orderPage: resources.orderPage,
    activeSchedule: resolvedSchedules.activeSchedule,
    nextSchedule: resolvedSchedules.nextSchedule,
    products: resources.products,
    optionGroups: resources.optionGroups,
    optionChoices: resources.optionChoices,
    links: resources.links,
  })
}

export async function loadPublicMobileOrderInventorySnapshot(
  supabase: any,
  token: string,
  options?: { applyStorePosSettings?: boolean }
): Promise<PublicMobileOrderInventorySnapshot | null> {
  const resources = await loadPublishedOrderResources(supabase, token, options)
  if (!resources) return null

  const resolvedSchedules = resolvePublicOrderSchedules(resources.schedules)
  const orderedQuantityByProduct = resolvedSchedules.activeSchedule
    ? await loadOrderedQuantityByProductForSchedule(supabase, resolvedSchedules.activeSchedule.id)
    : new Map<string, number>()
  const { inventoryByProduct, adjustmentsByProduct } = resolvedSchedules.activeSchedule
    ? await loadScheduleInventoryState(
        supabase,
        resolvedSchedules.activeSchedule.id,
        resources.products.map((product) => product.id)
      )
    : { inventoryByProduct: new Map(), adjustmentsByProduct: new Map() }

  return buildPublicMobileOrderInventorySnapshot({
    activeSchedule: resolvedSchedules.activeSchedule,
    nextSchedule: resolvedSchedules.nextSchedule,
    products: resources.products,
    orderedQuantityByProduct,
    inventoryByProduct,
    adjustmentsByProduct,
  })
}

export async function loadPublicMobileOrderHydratedPayload(
  supabase: any,
  token: string,
  options?: { applyStorePosSettings?: boolean }
): Promise<PublicMobileOrderPagePayload | null> {
  const [basePayload, inventorySnapshot] = await Promise.all([
    loadPublicMobileOrderBasePayload(supabase, token, options),
    loadPublicMobileOrderInventorySnapshot(supabase, token, options),
  ])

  if (!basePayload || !inventorySnapshot) {
    return null
  }

  return applyInventorySnapshotToPayload(basePayload, inventorySnapshot)
}
