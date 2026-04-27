import { NextRequest } from 'next/server'
import { requireRouteSession } from '@/lib/auth'
import { apiError, apiOk } from '@/lib/api-response'
import {
  ensureVendorStoreResources,
  getInventoryStatus,
  loadOrderedQuantityByProductForSchedule,
  loadScheduleInventoryState,
  resolveActiveSchedule,
} from '@/lib/mobile-order'
import type {
  MobileOrderInventoryAdjustmentRow,
  StoreOrderScheduleRow,
  VendorMobileOrderProductMutationPayload,
  VendorMobileOrderManagedProduct,
  VendorMobileOrderProductsPayload,
} from '@/types/api-payloads'

function normalizeBoolean(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback
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
      return apiError(error.message)
    }
    if (schedulesError) {
      return apiError(schedulesError.message)
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
        ...product,
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

    const payload: VendorMobileOrderProductsPayload = {
      store,
      currentSchedule,
      products: managedProducts,
    }

    return apiOk(payload)
  } catch (error) {
    console.error('[vendor/mobile-order/products GET]', error)
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
    const description = String(body.description ?? '').trim() || null
    const price = Number(body.price)
    const imageUrl = String(body.image_url ?? '').trim() || null
    const sortOrder = Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 0
    const tracksInventory = normalizeBoolean(body.tracks_inventory, false)
    const lowStockThreshold =
      body.low_stock_threshold == null || body.low_stock_threshold === ''
        ? 3
        : Number(body.low_stock_threshold)
    const isPublished = normalizeBoolean(body.is_published, true)
    const isSoldOut = normalizeBoolean(body.is_sold_out, false)

    if (!name) {
      return apiError('商品名は必須です', 400)
    }

    if (!Number.isInteger(price) || price < 0) {
      return apiError('価格は0円以上の整数で入力してください', 400)
    }
    if (!Number.isInteger(lowStockThreshold) || lowStockThreshold < 0) {
      return apiError('残りわずか閾値は0以上の整数で入力してください', 400)
    }

    const { data: vendorProfile } = await (supabase as any)
      .from('vendor_profiles')
      .select('business_name')
      .eq('user_id', user.id)
      .maybeSingle()

    const { store } = await ensureVendorStoreResources(supabase, user, {
      businessName: vendorProfile?.business_name ?? null,
    })

    const { data, error } = await (supabase as any)
      .from('mobile_order_products')
      .insert([
        {
          store_id: store.id,
          name,
          description,
          price,
          image_url: imageUrl,
          sort_order: sortOrder,
          tracks_inventory: tracksInventory,
          low_stock_threshold: lowStockThreshold,
          is_published: isPublished,
          is_sold_out: isSoldOut,
        },
      ])
      .select('*')
      .single()

    if (error) {
      return apiError(error.message)
    }

    const payload: VendorMobileOrderProductMutationPayload = data
    return apiOk(payload)
  } catch (error) {
    console.error('[vendor/mobile-order/products POST]', error)
    return apiError('サーバーエラー')
  }
}
