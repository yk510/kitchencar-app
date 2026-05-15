import {
  getInventoryStatus,
  loadOrderedQuantityByProductForSchedule,
  loadScheduleInventoryState,
  resolveActiveSchedule,
} from '@/lib/mobile-order'
import { applyStorePosSettingsToStore } from '@/lib/store-pos-settings'
import type {
  MobileOrderOptionChoiceRow,
  MobileOrderOptionGroupRow,
  MobileOrderProductRow,
  MobileOrderInventoryAdjustmentRow,
  PublicMobileOrderInventorySnapshot,
  PublicMobileOrderOptionGroup,
  PublicMobileOrderPagePayload,
  PublicMobileOrderProduct,
  StoreOrderScheduleRow,
} from '@/types/api-payloads'

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

export function buildPublicMobileOrderBaseProducts(args: {
  products: MobileOrderProductRow[]
  optionGroups: MobileOrderOptionGroupRow[]
  optionChoices: MobileOrderOptionChoiceRow[]
  links: Array<{ product_id: string; option_group_id: string }>
}): PublicMobileOrderProduct[] {
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

  return args.products.map((product) => ({
    ...product,
    current_schedule_inventory_id: null,
    current_initial_quantity: null,
    current_adjustment_total: 0,
    current_available_quantity: null,
    current_ordered_quantity: 0,
    current_remaining_quantity: null,
    current_inventory_status: product.tracks_inventory ? 'loading' : 'unmanaged',
    option_groups: (groupIdsByProduct.get(product.id) ?? [])
      .map((groupId) => groupsById.get(groupId))
      .filter(Boolean)
      .sort((a, b) => (a?.sort_order ?? 0) - (b?.sort_order ?? 0)) as PublicMobileOrderOptionGroup[],
  }))
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

  return {
    store: resources.store,
    orderPage: resources.orderPage,
    activeSchedule: resolvedSchedules.activeSchedule,
    nextSchedule: resolvedSchedules.nextSchedule,
    products: buildPublicMobileOrderBaseProducts({
      products: resources.products,
      optionGroups: resources.optionGroups,
      optionChoices: resources.optionChoices,
      links: resources.links,
    }),
    inventoryHydrated: false,
  }
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

  return {
    activeSchedule: resolvedSchedules.activeSchedule,
    nextSchedule: resolvedSchedules.nextSchedule,
    inventoryHydrated: true,
    products: resources.products.map((product) => {
      const currentInventory = inventoryByProduct.get(product.id) ?? null
      const currentAdjustments =
        (adjustmentsByProduct.get(product.id) ?? []) as MobileOrderInventoryAdjustmentRow[]
      const adjustmentTotal = currentAdjustments.reduce(
        (sum: number, adjustment: MobileOrderInventoryAdjustmentRow) =>
          sum + Number(adjustment.adjustment_quantity ?? 0),
        0
      )
      const inventory = getInventoryStatus({
        tracks_inventory: product.tracks_inventory,
        initial_quantity: currentInventory?.initial_quantity ?? null,
        adjustment_total: adjustmentTotal,
        low_stock_threshold: product.low_stock_threshold,
        ordered_quantity: orderedQuantityByProduct.get(product.id) ?? 0,
        is_sold_out: product.is_sold_out,
      })

      return {
        id: product.id,
        current_schedule_inventory_id: currentInventory?.id ?? null,
        current_initial_quantity: currentInventory?.initial_quantity ?? null,
        current_adjustment_total: adjustmentTotal,
        current_available_quantity: inventory.availableQuantity,
        current_ordered_quantity: orderedQuantityByProduct.get(product.id) ?? 0,
        current_remaining_quantity: inventory.remainingQuantity,
        current_inventory_status: inventory.status,
      }
    }),
  }
}

export function applyInventorySnapshotToPayload(
  payload: PublicMobileOrderPagePayload,
  snapshot: PublicMobileOrderInventorySnapshot
): PublicMobileOrderPagePayload {
  const inventoryByProductId = new Map(snapshot.products.map((product) => [product.id, product]))

  return {
    ...payload,
    activeSchedule: snapshot.activeSchedule,
    nextSchedule: snapshot.nextSchedule,
    inventoryHydrated: true,
    products: payload.products.map((product) => ({
      ...product,
      ...(inventoryByProductId.get(product.id) ?? {}),
    })),
  }
}
