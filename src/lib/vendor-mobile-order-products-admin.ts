import {
  ensureVendorStoreResources,
  getInventoryStatus,
  loadOrderedQuantityByProductForSchedule,
  loadScheduleInventoryState,
  resolveActiveSchedule,
} from '@/lib/mobile-order'
import { isMissingMobileOrderProductDisplayColumnsError } from '@/lib/mobile-order-fields'
import {
  normalizeDisplayCategory,
  normalizeProductDisplayCategory,
  normalizeProductRecord,
} from '@/lib/vendor-mobile-order-products-payload'
import type {
  MobileOrderInventoryAdjustmentRow,
  MobileOrderProductRow,
  StoreOrderScheduleRow,
  VendorMobileOrderManagedProduct,
  VendorMobileOrderProductMutationPayload,
  VendorMobileOrderProductsPayload,
} from '@/types/api-payloads'

function normalizeBoolean(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback
}

function normalizeMaybeBoolean(value: unknown) {
  return typeof value === 'boolean' ? value : undefined
}

async function loadVendorBusinessName(supabase: any, userId: string) {
  const { data } = await (supabase as any)
    .from('vendor_profiles')
    .select('business_name')
    .eq('user_id', userId)
    .maybeSingle()

  return data?.business_name ?? null
}

export async function getVendorManagedProductsPayload(supabase: any, user: { id: string }): Promise<VendorMobileOrderProductsPayload> {
  const businessName = await loadVendorBusinessName(supabase, user.id)
  const { store } = await ensureVendorStoreResources(supabase, user, { businessName })

  const [{ data: products, error }, { data: schedules, error: schedulesError }] = await Promise.all([
    (supabase as any)
      .from('mobile_order_products')
      .select('*')
      .eq('store_id', store.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    (supabase as any)
      .from('store_order_schedules')
      .select('*')
      .eq('store_id', store.id)
      .order('opens_at', { ascending: true }),
  ])

  if (error) {
    throw new Error(error.message)
  }
  if (schedulesError) {
    throw new Error(schedulesError.message)
  }

  const currentSchedule = resolveActiveSchedule((schedules ?? []) as StoreOrderScheduleRow[])
  const orderedQuantityByProduct = currentSchedule
    ? await loadOrderedQuantityByProductForSchedule(supabase, currentSchedule.id)
    : new Map<string, number>()
  const { inventoryByProduct, adjustmentsByProduct } = currentSchedule
    ? await loadScheduleInventoryState(
        supabase,
        currentSchedule.id,
        ((products ?? []) as Array<{ id: string }>).map((product) => product.id)
      )
    : { inventoryByProduct: new Map(), adjustmentsByProduct: new Map() }

  const managedProducts: VendorMobileOrderManagedProduct[] = ((products ?? []) as any[]).map((product) => {
    const currentOrderedQuantity = orderedQuantityByProduct.get(product.id) ?? 0
    const currentInventory = inventoryByProduct.get(product.id) ?? null
    const currentAdjustments = (adjustmentsByProduct.get(product.id) ?? []) as MobileOrderInventoryAdjustmentRow[]
    const adjustmentTotal = currentAdjustments.reduce(
      (sum: number, adjustment: MobileOrderInventoryAdjustmentRow) => sum + Number(adjustment.adjustment_quantity ?? 0),
      0
    )
    const inventory = getInventoryStatus({
      tracks_inventory: product.tracks_inventory,
      initial_quantity: currentInventory?.initial_quantity ?? null,
      adjustment_total: adjustmentTotal,
      low_stock_threshold: product.low_stock_threshold,
      ordered_quantity: currentOrderedQuantity,
      is_sold_out: product.is_sold_out,
    })

    return {
      ...normalizeProductRecord(product),
      current_schedule_inventory_id: currentInventory?.id ?? null,
      current_initial_quantity: currentInventory?.initial_quantity ?? null,
      current_adjustment_total: adjustmentTotal,
      current_available_quantity: inventory.availableQuantity,
      current_ordered_quantity: currentOrderedQuantity,
      current_remaining_quantity: inventory.remainingQuantity,
      current_inventory_status: inventory.status,
      current_inventory_adjustments: currentAdjustments,
    }
  })

  return {
    store,
    currentSchedule,
    products: managedProducts,
  }
}

export async function loadVendorOwnedMobileOrderProduct(
  supabase: any,
  userId: string,
  productId: string
): Promise<MobileOrderProductRow & { vendor_stores: { vendor_user_id: string } }> {
  const { data: product, error } = await (supabase as any)
    .from('mobile_order_products')
    .select('*, vendor_stores!inner(vendor_user_id)')
    .eq('id', productId)
    .eq('vendor_stores.vendor_user_id', userId)
    .single()

  if (error || !product) {
    throw new Error('対象の商品が見つかりません')
  }

  return product
}

function buildBaseMutationRow(input: {
  name: string
  description: string | null
  price: number
  image_url: string | null
  sort_order: number
  tracks_inventory: boolean
  low_stock_threshold: number
  is_published: boolean
  is_sold_out: boolean
}) {
  return {
    name: input.name,
    description: input.description,
    price: input.price,
    image_url: input.image_url,
    sort_order: input.sort_order,
    tracks_inventory: input.tracks_inventory,
    low_stock_threshold: input.low_stock_threshold,
    is_published: input.is_published,
    is_sold_out: input.is_sold_out,
  }
}

export function parseCreateProductInput(body: any) {
  const name = String(body.name ?? '').trim()
  const description = String(body.description ?? '').trim() || null
  const price = Number(body.price)
  const image_url = String(body.image_url ?? '').trim() || null
  const sort_order = Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 0
  const display_category = normalizeProductDisplayCategory(body.display_category)
  const is_recommended = normalizeBoolean(body.is_recommended, false)
  const tracks_inventory = normalizeBoolean(body.tracks_inventory, false)
  const low_stock_threshold =
    body.low_stock_threshold == null || body.low_stock_threshold === '' ? 3 : Number(body.low_stock_threshold)
  const is_published = normalizeBoolean(body.is_published, true)
  const is_sold_out = normalizeBoolean(body.is_sold_out, false)

  if (!name) {
    throw new Error('商品名は必須です')
  }
  if (!Number.isInteger(price) || price < 0) {
    throw new Error('価格は0円以上の整数で入力してください')
  }
  if (!Number.isInteger(low_stock_threshold) || low_stock_threshold < 0) {
    throw new Error('残りわずか閾値は0以上の整数で入力してください')
  }

  return {
    name,
    description,
    price,
    image_url,
    sort_order,
    display_category,
    is_recommended,
    tracks_inventory,
    low_stock_threshold,
    is_published,
    is_sold_out,
  }
}

export function parseUpdateProductInput(body: any, current: MobileOrderProductRow) {
  const name = typeof body.name === 'string' ? body.name.trim() : current.name
  const description =
    typeof body.description === 'string'
      ? body.description.trim() || null
      : body.description === null
        ? null
        : current.description
  const image_url =
    typeof body.image_url === 'string'
      ? body.image_url.trim() || null
      : body.image_url === null
        ? null
        : current.image_url
  const price = body.price != null ? Number(body.price) : current.price
  const sort_order = body.sort_order != null ? Number(body.sort_order) : current.sort_order
  const display_category =
    body.display_category != null
      ? normalizeProductDisplayCategory(body.display_category)
      : normalizeDisplayCategory(current.display_category)
  const is_recommended =
    normalizeMaybeBoolean(body.is_recommended) ?? (typeof current.is_recommended === 'boolean' ? current.is_recommended : false)
  const tracks_inventory = typeof body.tracks_inventory === 'boolean' ? body.tracks_inventory : current.tracks_inventory
  const low_stock_threshold =
    body.low_stock_threshold === '' ? 3 : body.low_stock_threshold != null ? Number(body.low_stock_threshold) : current.low_stock_threshold
  const is_published = normalizeMaybeBoolean(body.is_published) ?? current.is_published
  const is_sold_out = normalizeMaybeBoolean(body.is_sold_out) ?? current.is_sold_out

  if (!name) {
    throw new Error('商品名は必須です')
  }
  if (!Number.isInteger(price) || price < 0) {
    throw new Error('価格は0円以上の整数で入力してください')
  }
  if (!Number.isInteger(sort_order) || sort_order < 0) {
    throw new Error('表示順は0以上の整数で入力してください')
  }
  if (!Number.isInteger(low_stock_threshold) || low_stock_threshold < 0) {
    throw new Error('残りわずか閾値は0以上の整数で入力してください')
  }

  return {
    name,
    description,
    price,
    image_url,
    sort_order,
    display_category,
    is_recommended,
    tracks_inventory,
    low_stock_threshold,
    is_published,
    is_sold_out,
  }
}

export async function createVendorMobileOrderProduct(
  supabase: any,
  user: { id: string },
  input: ReturnType<typeof parseCreateProductInput>
): Promise<VendorMobileOrderProductMutationPayload> {
  const businessName = await loadVendorBusinessName(supabase, user.id)
  const { store } = await ensureVendorStoreResources(supabase, user, { businessName })

  const baseInsertRow = {
    store_id: store.id,
    ...buildBaseMutationRow(input),
  }

  let data
  let error

  ;({ data, error } = await (supabase as any)
    .from('mobile_order_products')
    .insert([
      {
        ...baseInsertRow,
        display_category: input.display_category,
        is_recommended: input.is_recommended,
      },
    ])
    .select('*')
    .single())

  if (error && isMissingMobileOrderProductDisplayColumnsError(error)) {
    ;({ data, error } = await (supabase as any).from('mobile_order_products').insert([baseInsertRow]).select('*').single())
  }

  if (error) {
    throw new Error(error.message)
  }

  return normalizeProductRecord(data)
}

export async function updateVendorMobileOrderProduct(
  supabase: any,
  productId: string,
  input: ReturnType<typeof parseUpdateProductInput>
): Promise<VendorMobileOrderProductMutationPayload> {
  const basePatch = buildBaseMutationRow(input)

  let data
  let error

  ;({ data, error } = await (supabase as any)
    .from('mobile_order_products')
    .update({
      ...basePatch,
      display_category: input.display_category,
      is_recommended: input.is_recommended,
    })
    .eq('id', productId)
    .select('*')
    .single())

  if (error && isMissingMobileOrderProductDisplayColumnsError(error)) {
    ;({ data, error } = await (supabase as any).from('mobile_order_products').update(basePatch).eq('id', productId).select('*').single())
  }

  if (error) {
    throw new Error(error.message)
  }

  return normalizeProductRecord(data)
}
