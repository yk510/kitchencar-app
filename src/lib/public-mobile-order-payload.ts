import type {
  MobileOrderInventoryAdjustmentRow,
  MobileOrderOptionChoiceRow,
  MobileOrderOptionGroupRow,
  MobileOrderProductRow,
  PublicMobileOrderInventorySnapshot,
  PublicMobileOrderOptionGroup,
  PublicMobileOrderPagePayload,
  PublicMobileOrderProduct,
  StoreOrderPageRow,
  StoreOrderScheduleRow,
  VendorStoreRow,
} from '@/types/api-payloads'
import { getInventoryStatus } from '@/lib/mobile-order'

type OrderPageMeta = Pick<
  StoreOrderPageRow,
  'id' | 'store_id' | 'page_title' | 'public_token' | 'status' | 'is_primary' | 'notes' | 'created_at' | 'updated_at'
>

export function formatPublicOrderPageMeta(orderPage: any): OrderPageMeta {
  return {
    id: orderPage.id,
    store_id: orderPage.store_id,
    page_title: orderPage.page_title,
    public_token: orderPage.public_token,
    status: orderPage.status,
    is_primary: orderPage.is_primary,
    notes: orderPage.notes,
    created_at: orderPage.created_at,
    updated_at: orderPage.updated_at,
  }
}

export function buildPublicMobileOrderOptionGroups(args: {
  optionGroups: MobileOrderOptionGroupRow[]
  optionChoices: MobileOrderOptionChoiceRow[]
}): Map<string, PublicMobileOrderOptionGroup> {
  const choicesByGroup = new Map<string, MobileOrderOptionChoiceRow[]>()
  for (const choice of args.optionChoices) {
    const current = choicesByGroup.get(choice.group_id) ?? []
    current.push(choice)
    choicesByGroup.set(choice.group_id, current)
  }

  return new Map(
    args.optionGroups.map((group) => [
      group.id,
      {
        ...group,
        choices: (choicesByGroup.get(group.id) ?? []).sort((a, b) => a.sort_order - b.sort_order),
      },
    ])
  )
}

export function buildPublicMobileOrderProducts(args: {
  products: MobileOrderProductRow[]
  groupsById: Map<string, PublicMobileOrderOptionGroup>
  links: Array<{ product_id: string; option_group_id: string }>
  orderedQuantityByProduct?: Map<string, number>
  inventoryByProduct?: Map<string, { id: string; product_id: string; initial_quantity: number }>
  adjustmentsByProduct?: Map<string, MobileOrderInventoryAdjustmentRow[]>
  hydrateInventory: boolean
}): PublicMobileOrderProduct[] {
  const groupIdsByProduct = new Map<string, string[]>()
  for (const link of args.links) {
    const current = groupIdsByProduct.get(link.product_id) ?? []
    current.push(link.option_group_id)
    groupIdsByProduct.set(link.product_id, current)
  }

  return args.products.map((product) => {
    if (!args.hydrateInventory) {
      return {
        ...product,
        current_schedule_inventory_id: null,
        current_initial_quantity: null,
        current_adjustment_total: 0,
        current_available_quantity: null,
        current_ordered_quantity: 0,
        current_remaining_quantity: null,
        current_inventory_status: product.tracks_inventory ? 'loading' : 'unmanaged',
        option_groups: (groupIdsByProduct.get(product.id) ?? [])
          .map((groupId) => args.groupsById.get(groupId))
          .filter(Boolean)
          .sort((a, b) => (a?.sort_order ?? 0) - (b?.sort_order ?? 0)) as PublicMobileOrderOptionGroup[],
      }
    }

    const currentInventory = args.inventoryByProduct?.get(product.id) ?? null
    const currentAdjustments =
      (args.adjustmentsByProduct?.get(product.id) ?? []) as MobileOrderInventoryAdjustmentRow[]
    const adjustmentTotal = currentAdjustments.reduce(
      (sum, adjustment) => sum + Number(adjustment.adjustment_quantity ?? 0),
      0
    )
    const orderedQuantity = args.orderedQuantityByProduct?.get(product.id) ?? 0
    const inventory = getInventoryStatus({
      tracks_inventory: product.tracks_inventory,
      initial_quantity: currentInventory?.initial_quantity ?? null,
      adjustment_total: adjustmentTotal,
      low_stock_threshold: product.low_stock_threshold,
      ordered_quantity: orderedQuantity,
      is_sold_out: product.is_sold_out,
    })

    return {
      ...product,
      current_schedule_inventory_id: currentInventory?.id ?? null,
      current_initial_quantity: currentInventory?.initial_quantity ?? null,
      current_adjustment_total: adjustmentTotal,
      current_available_quantity: inventory.availableQuantity,
      current_ordered_quantity: orderedQuantity,
      current_remaining_quantity: inventory.remainingQuantity,
      current_inventory_status: inventory.status,
      option_groups: (groupIdsByProduct.get(product.id) ?? [])
        .map((groupId) => args.groupsById.get(groupId))
        .filter(Boolean)
        .sort((a, b) => (a?.sort_order ?? 0) - (b?.sort_order ?? 0)) as PublicMobileOrderOptionGroup[],
    }
  })
}

export function buildPublicMobileOrderBasePayload(args: {
  store: VendorStoreRow
  orderPage: any
  activeSchedule: StoreOrderScheduleRow | null
  nextSchedule: StoreOrderScheduleRow | null
  products: MobileOrderProductRow[]
  optionGroups: MobileOrderOptionGroupRow[]
  optionChoices: MobileOrderOptionChoiceRow[]
  links: Array<{ product_id: string; option_group_id: string }>
}): PublicMobileOrderPagePayload {
  const groupsById = buildPublicMobileOrderOptionGroups({
    optionGroups: args.optionGroups,
    optionChoices: args.optionChoices,
  })

  return {
    store: args.store,
    orderPage: formatPublicOrderPageMeta(args.orderPage),
    activeSchedule: args.activeSchedule,
    nextSchedule: args.nextSchedule,
    inventoryHydrated: false,
    products: buildPublicMobileOrderProducts({
      products: args.products,
      groupsById,
      links: args.links,
      hydrateInventory: false,
    }),
  }
}

export function buildPublicMobileOrderInventorySnapshot(args: {
  activeSchedule: StoreOrderScheduleRow | null
  nextSchedule: StoreOrderScheduleRow | null
  products: MobileOrderProductRow[]
  orderedQuantityByProduct: Map<string, number>
  inventoryByProduct: Map<string, { id: string; product_id: string; initial_quantity: number }>
  adjustmentsByProduct: Map<string, MobileOrderInventoryAdjustmentRow[]>
}): PublicMobileOrderInventorySnapshot {
  const products = args.products.map((product) => {
    const currentInventory = args.inventoryByProduct.get(product.id) ?? null
    const currentAdjustments =
      (args.adjustmentsByProduct.get(product.id) ?? []) as MobileOrderInventoryAdjustmentRow[]
    const adjustmentTotal = currentAdjustments.reduce(
      (sum, adjustment) => sum + Number(adjustment.adjustment_quantity ?? 0),
      0
    )
    const orderedQuantity = args.orderedQuantityByProduct.get(product.id) ?? 0
    const inventory = getInventoryStatus({
      tracks_inventory: product.tracks_inventory,
      initial_quantity: currentInventory?.initial_quantity ?? null,
      adjustment_total: adjustmentTotal,
      low_stock_threshold: product.low_stock_threshold,
      ordered_quantity: orderedQuantity,
      is_sold_out: product.is_sold_out,
    })

    return {
      id: product.id,
      current_schedule_inventory_id: currentInventory?.id ?? null,
      current_initial_quantity: currentInventory?.initial_quantity ?? null,
      current_adjustment_total: adjustmentTotal,
      current_available_quantity: inventory.availableQuantity,
      current_ordered_quantity: orderedQuantity,
      current_remaining_quantity: inventory.remainingQuantity,
      current_inventory_status: inventory.status,
    }
  })

  return {
    activeSchedule: args.activeSchedule,
    nextSchedule: args.nextSchedule,
    inventoryHydrated: true,
    products,
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
