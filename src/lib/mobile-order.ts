import type { User } from '@supabase/supabase-js'
import { isMissingMobileOrderExtendedColumnsError } from '@/lib/mobile-order-fields'
import type { Database } from '@/types/database'

type StoreOrderScheduleInventoryRow = Database['public']['Tables']['store_order_schedule_inventories']['Row']
type MobileOrderInventoryAdjustmentRow = Database['public']['Tables']['mobile_order_inventory_adjustments']['Row']
type MobileOrderInventoryStatus = 'unmanaged' | 'not_set' | 'available' | 'low_stock' | 'sold_out'

function slugifyStoreName(value: string) {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

function buildDefaultStoreName(rawName?: string | null, email?: string | null) {
  const trimmedName = String(rawName ?? '').trim()
  if (trimmedName) return trimmedName

  const emailName = String(email ?? '').split('@')[0]?.trim()
  if (emailName) return `${emailName} store`

  return 'mobile-order-store'
}

function buildDefaultSlug(storeName: string, userId: string) {
  const normalized = slugifyStoreName(storeName)
  const suffix = userId.slice(0, 8).toLowerCase()
  return normalized ? `${normalized}-${suffix}` : `store-${suffix}`
}

function buildLegacyOrderNumberPrefix(storeName: string, userId: string) {
  const normalized = storeName.normalize('NFKC').toUpperCase()
  const alpha = normalized.match(/[A-Z]/)?.[0]
  if (alpha) return alpha

  const fallbackFromUser = userId.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 1)
  if (fallbackFromUser) return fallbackFromUser

  return 'K'
}

function formatStoreCode(value: number) {
  return String(value).padStart(4, '0')
}

function formatDailySequence(value: number) {
  return String(value).padStart(4, '0')
}

async function allocateStoreCode() {
  const min = 1
  const max = 9999
  const nextValue = Math.floor(Math.random() * (max - min + 1)) + min
  return formatStoreCode(nextValue)
}

function isDuplicateStoreCodeError(error: unknown) {
  const message = String((error as { message?: string } | null)?.message ?? '')
  return message.includes('idx_vendor_stores_store_code') || message.includes('vendor_stores_store_code_key')
}

function isDuplicateStoreSlugError(error: unknown) {
  const message = String((error as { message?: string } | null)?.message ?? '')
  return message.includes('vendor_stores_slug_key')
}

function isRetryableVendorStoreInsertError(error: unknown) {
  return isDuplicateStoreCodeError(error) || isDuplicateStoreSlugError(error)
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

async function findExistingVendorStore(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from('vendor_stores')
    .select('*')
    .eq('vendor_user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return data
}

async function normalizePrimaryOrderPage(
  supabase: any,
  store: { id: string; store_name: string }
) {
  const { data: pages, error } = await supabase
    .from('store_order_pages')
    .select('*')
    .eq('store_id', store.id)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  const orderedPages = (pages ?? []) as Array<any>
  const primaryCandidates = orderedPages.filter((page) => page.is_primary)
  const canonicalPage = primaryCandidates[0] ?? orderedPages[0] ?? null

  if (!canonicalPage) {
    return null
  }

  const pagesToDemote = primaryCandidates.slice(1).map((page) => page.id)
  if (pagesToDemote.length > 0) {
    const { error: demoteError } = await supabase
      .from('store_order_pages')
      .update({ is_primary: false })
      .in('id', pagesToDemote)

    if (demoteError) {
      throw new Error(demoteError.message)
    }
  }

  if (canonicalPage.status !== 'published' || canonicalPage.is_primary !== true) {
    const { data: updatedPage, error: updateError } = await supabase
      .from('store_order_pages')
      .update({
        status: 'published',
        is_primary: true,
        page_title: canonicalPage.page_title || `${store.store_name} モバイルオーダー`,
      })
      .eq('id', canonicalPage.id)
      .select('*')
      .single()

    if (updateError) {
      throw new Error(updateError.message)
    }

    return updatedPage
  }

  return canonicalPage
}

export async function ensureVendorStoreResources(
  supabase: any,
  user: User,
  options?: { businessName?: string | null }
) {
  let store = await findExistingVendorStore(supabase, user.id)

  if (!store) {
    const storeName = buildDefaultStoreName(options?.businessName, user.email)
    const slug = buildDefaultSlug(storeName, user.id)
    const legacyOrderNumberPrefix = buildLegacyOrderNumberPrefix(storeName, user.id)

    const tryInsert = async (includeLegacyPrefix: boolean) =>
      await supabase
        .from('vendor_stores')
        .insert([
          {
            vendor_user_id: user.id,
            store_name: storeName,
            slug,
            store_code: await allocateStoreCode(),
            ...(includeLegacyPrefix ? { order_number_prefix: legacyOrderNumberPrefix } : {}),
            is_mobile_order_enabled: false,
            is_accepting_orders: true,
          },
        ])
        .select('*')
        .single()

    let lastInsertError: any = null

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const latestStore = await findExistingVendorStore(supabase, user.id)
      if (latestStore) {
        store = latestStore
        break
      }

      let insertedStore: any = null
      let insertStoreError: any = null

      ;({ data: insertedStore, error: insertStoreError } = await tryInsert(true))

      if (insertStoreError && String(insertStoreError.message ?? '').includes('order_number_prefix')) {
        ;({ data: insertedStore, error: insertStoreError } = await tryInsert(false))
      }

      if (!insertStoreError) {
        store = insertedStore
        break
      }

      lastInsertError = insertStoreError

      if (!isRetryableVendorStoreInsertError(insertStoreError)) {
        throw new Error(insertStoreError.message)
      }

      await sleep(50 * (attempt + 1))
    }

    if (!store) {
      store = await findExistingVendorStore(supabase, user.id)
    }

    if (!store && lastInsertError) {
      throw new Error(lastInsertError.message)
    }
  }

  if (!store) {
    throw new Error('店舗情報の作成に失敗しました。時間を置いて再度お試しください。')
  }

  let orderPage = await normalizePrimaryOrderPage(supabase, store)

  if (!orderPage) {
    const { data: insertedPage, error: insertPageError } = await supabase
      .from('store_order_pages')
      .insert([
        {
          store_id: store.id,
          page_title: `${store.store_name} モバイルオーダー`,
          public_token: crypto.randomUUID().replace(/-/g, ''),
          status: 'published',
          is_primary: true,
        },
      ])
      .select('*')
      .single()

    if (insertPageError) {
      throw new Error(insertPageError.message)
    }

    orderPage =
      (await normalizePrimaryOrderPage(supabase, store)) ??
      insertedPage
  }

  return {
    store,
    orderPage,
  }
}

export function resolveActiveSchedule<T extends { opens_at: string; closes_at: string; status: string }>(schedules: T[]) {
  const now = Date.now()

  return (
    schedules.find((schedule) => {
      if (!['scheduled', 'open'].includes(schedule.status)) return false
      const startsAt = new Date(schedule.opens_at).getTime()
      const endsAt = new Date(schedule.closes_at).getTime()
      return startsAt <= now && now < endsAt
    }) ?? null
  )
}

export async function generateNextOrderNumber(
  supabase: any,
  store: { id: string; store_code: string },
  businessDate: string
) {
  const { data, error } = await supabase
    .from('mobile_orders')
    .select('order_daily_sequence, store_order_schedules!inner(business_date)')
    .eq('store_id', store.id)
    .eq('store_order_schedules.business_date', businessDate)
    .order('order_daily_sequence', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  const latestSequence = Number(data?.order_daily_sequence ?? 0) || 0
  const nextSequence = latestSequence + 1

  if (nextSequence > 9999) {
    throw new Error('注文番号の上限に達しました')
  }

  return {
    orderNumber: `${store.store_code}-${formatDailySequence(nextSequence)}`,
    dailySequence: nextSequence,
  }
}

export async function insertMobileOrderWithGeneratedNumber(
  supabase: any,
  store: { id: string; store_code: string },
  businessDate: string,
  payload: Record<string, unknown>
) {
  const stripExtendedFields = (record: Record<string, unknown>) => {
    const next = { ...record }
    delete next.order_source
    delete next.payment_method
    delete next.paid_at
    delete next.accepted_by_user_id
    delete next.pos_device_label
    return next
  }

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { orderNumber, dailySequence } = await generateNextOrderNumber(supabase, store, businessDate)

    const record = {
      ...payload,
      order_number: orderNumber,
      order_daily_sequence: dailySequence,
    }

    let { data, error } = await supabase
      .from('mobile_orders')
      .insert([record])
      .select('*')
      .single()

    if (error && isMissingMobileOrderExtendedColumnsError(error)) {
      ;({ data, error } = await supabase
        .from('mobile_orders')
        .insert([stripExtendedFields(record)])
        .select('*')
        .single())
    }

    if (!error) {
      return data
    }

    if (
      error.code === '23505' &&
      (
        String(error.message ?? '').includes('mobile_orders_order_number_key') ||
        String(error.message ?? '').includes('mobile_orders_schedule_id_order_daily_sequence_key')
      )
    ) {
      continue
    }

    throw new Error(error.message)
  }

  throw new Error('注文番号の採番に失敗しました。時間をおいて再度お試しください。')
}

export async function loadOrderedQuantityByProductForSchedule(
  supabase: any,
  scheduleId: string
) {
  const { data, error } = await supabase
    .from('mobile_order_items')
    .select('product_id, quantity, mobile_orders!inner(schedule_id, status)')
    .eq('mobile_orders.schedule_id', scheduleId)
    .neq('mobile_orders.status', 'cancelled')

  if (error) {
    throw new Error(error.message)
  }

  const totals = new Map<string, number>()

  for (const row of (data ?? []) as Array<{ product_id: string; quantity: number; mobile_orders: { schedule_id: string; status: string } }>) {
    totals.set(row.product_id, (totals.get(row.product_id) ?? 0) + Number(row.quantity ?? 0))
  }

  return totals
}

export async function loadScheduleInventoryState(
  supabase: any,
  scheduleId: string,
  productIds?: string[]
) {
  let inventoryQuery = supabase
    .from('store_order_schedule_inventories')
    .select('*')
    .eq('schedule_id', scheduleId)

  let adjustmentsQuery = supabase
    .from('mobile_order_inventory_adjustments')
    .select('*')
    .eq('schedule_id', scheduleId)
    .order('created_at', { ascending: false })

  if (productIds && productIds.length > 0) {
    inventoryQuery = inventoryQuery.in('product_id', productIds)
    adjustmentsQuery = adjustmentsQuery.in('product_id', productIds)
  }

  const [{ data: inventories, error: inventoriesError }, { data: adjustments, error: adjustmentsError }] =
    await Promise.all([inventoryQuery, adjustmentsQuery])

  if (inventoriesError) {
    throw new Error(inventoriesError.message)
  }
  if (adjustmentsError) {
    throw new Error(adjustmentsError.message)
  }

  const inventoryByProduct = new Map<string, StoreOrderScheduleInventoryRow>()
  for (const inventory of (inventories ?? []) as StoreOrderScheduleInventoryRow[]) {
    inventoryByProduct.set(inventory.product_id, inventory)
  }

  const adjustmentsByProduct = new Map<string, MobileOrderInventoryAdjustmentRow[]>()
  for (const adjustment of (adjustments ?? []) as MobileOrderInventoryAdjustmentRow[]) {
    const current = adjustmentsByProduct.get(adjustment.product_id) ?? []
    current.push(adjustment)
    adjustmentsByProduct.set(adjustment.product_id, current)
  }

  return {
    inventoryByProduct,
    adjustmentsByProduct,
  }
}

export function getInventoryStatus(input: {
  tracks_inventory: boolean
  initial_quantity: number | null
  adjustment_total: number
  low_stock_threshold: number
  ordered_quantity: number
  is_sold_out: boolean
}) {
  const availableQuantity =
    input.initial_quantity == null ? null : Math.max(0, input.initial_quantity + input.adjustment_total)

  if (input.is_sold_out) {
    return {
      status: 'sold_out' as MobileOrderInventoryStatus,
      availableQuantity,
      remainingQuantity: availableQuantity == null ? null : Math.max(0, availableQuantity - input.ordered_quantity),
    }
  }

  if (!input.tracks_inventory) {
    return {
      status: 'unmanaged' as MobileOrderInventoryStatus,
      availableQuantity: null,
      remainingQuantity: null,
    }
  }

  if (input.initial_quantity == null) {
    return {
      status: 'not_set' as MobileOrderInventoryStatus,
      availableQuantity: null,
      remainingQuantity: null,
    }
  }

  const remainingQuantity = Math.max(0, (availableQuantity ?? 0) - input.ordered_quantity)

  if (remainingQuantity <= 0) {
    return {
      status: 'sold_out' as MobileOrderInventoryStatus,
      availableQuantity: availableQuantity ?? 0,
      remainingQuantity: 0,
    }
  }

  if (remainingQuantity <= input.low_stock_threshold) {
    return {
      status: 'low_stock' as MobileOrderInventoryStatus,
      availableQuantity: availableQuantity ?? remainingQuantity,
      remainingQuantity,
    }
  }

  return {
    status: 'available' as MobileOrderInventoryStatus,
    availableQuantity: availableQuantity ?? remainingQuantity,
    remainingQuantity,
  }
}
