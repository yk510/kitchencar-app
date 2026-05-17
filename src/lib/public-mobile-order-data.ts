import {
  resolveActiveSchedule,
} from '@/lib/mobile-order'
import { loadPublicOrderInventoryState } from '@/lib/public-mobile-order-inventory-loader'
import {
  applyInventorySnapshotToPayload,
  buildPublicMobileOrderBasePayload,
  buildPublicMobileOrderInventorySnapshot,
} from '@/lib/public-mobile-order-payload'
import { loadPublishedOrderResources } from '@/lib/public-mobile-order-resource-loader'
import type {
  PublicMobileOrderInventorySnapshot,
  PublicMobileOrderPagePayload,
  StoreOrderScheduleRow,
} from '@/types/api-payloads'

export { applyInventorySnapshotToPayload } from '@/lib/public-mobile-order-payload'

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
  const { orderedQuantityByProduct, inventoryByProduct, adjustmentsByProduct } =
    await loadPublicOrderInventoryState(supabase, resolvedSchedules.activeSchedule?.id ?? null, resources.products)

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
