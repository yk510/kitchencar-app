import type { StoreOrderPageRow } from '@/types/api-payloads'
import type { Database } from '@/types/database'

const PRODUCT_MASTER_LINKS_START = '[kuridas:product-master-links]'
const PRODUCT_MASTER_LINKS_END = '[/kuridas:product-master-links]'

export type ProductMasterLinkMode = 'dedicated' | 'matched_existing'

export type MobileOrderProductMasterLink = {
  product_master_id: string
  mode: ProductMasterLinkMode
}

type ProductMasterLinksMetadata = {
  mobile_order_product_links: Record<string, MobileOrderProductMasterLink>
  mobile_order_option_choice_links: Record<string, MobileOrderProductMasterLink>
}

type ProductMasterRow = Database['public']['Tables']['product_master']['Row']

function parseJsonObject(value: string) {
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

function buildPattern(start: string, end: string) {
  return new RegExp(
    `${start.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([\\s\\S]*?)${end.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`
  )
}

export function extractProductMasterLinksFromNotes(
  notes: string | null | undefined
): ProductMasterLinksMetadata | null {
  const text = String(notes ?? '')
  if (!text.includes(PRODUCT_MASTER_LINKS_START) || !text.includes(PRODUCT_MASTER_LINKS_END)) {
    return null
  }

  const match = text.match(buildPattern(PRODUCT_MASTER_LINKS_START, PRODUCT_MASTER_LINKS_END))
  if (!match?.[1]) return null

  const parsed = parseJsonObject(match[1].trim())
  if (!parsed) return null

  const metadata = parsed as Record<string, unknown>
  const rawLinks =
    metadata.mobile_order_product_links && typeof metadata.mobile_order_product_links === 'object'
      ? (metadata.mobile_order_product_links as Record<string, unknown>)
      : {}
  const rawOptionLinks =
    metadata.mobile_order_option_choice_links && typeof metadata.mobile_order_option_choice_links === 'object'
      ? (metadata.mobile_order_option_choice_links as Record<string, unknown>)
      : {}

  const normalizedLinks: Record<string, MobileOrderProductMasterLink> = {}
  const normalizedOptionLinks: Record<string, MobileOrderProductMasterLink> = {}
  for (const [productId, value] of Object.entries(rawLinks)) {
    if (!value || typeof value !== 'object') continue

    const candidate = value as Record<string, unknown>
    const productMasterId = typeof candidate.product_master_id === 'string' ? candidate.product_master_id.trim() : ''
    const mode = candidate.mode === 'matched_existing' ? 'matched_existing' : candidate.mode === 'dedicated' ? 'dedicated' : null
    if (!productMasterId || !mode) continue

    normalizedLinks[productId] = {
      product_master_id: productMasterId,
      mode,
    }
  }

  for (const [optionChoiceId, value] of Object.entries(rawOptionLinks)) {
    if (!value || typeof value !== 'object') continue

    const candidate = value as Record<string, unknown>
    const productMasterId = typeof candidate.product_master_id === 'string' ? candidate.product_master_id.trim() : ''
    const mode = candidate.mode === 'matched_existing' ? 'matched_existing' : candidate.mode === 'dedicated' ? 'dedicated' : null
    if (!productMasterId || !mode) continue

    normalizedOptionLinks[optionChoiceId] = {
      product_master_id: productMasterId,
      mode,
    }
  }

  return {
    mobile_order_product_links: normalizedLinks,
    mobile_order_option_choice_links: normalizedOptionLinks,
  }
}

export function upsertProductMasterLinksInNotes(
  notes: string | null | undefined,
  links: {
    mobile_order_product_links: Record<string, MobileOrderProductMasterLink>
    mobile_order_option_choice_links: Record<string, MobileOrderProductMasterLink>
  }
) {
  const metadataBlock = `${PRODUCT_MASTER_LINKS_START}\n${JSON.stringify({
    mobile_order_product_links: links.mobile_order_product_links,
    mobile_order_option_choice_links: links.mobile_order_option_choice_links,
  })}\n${PRODUCT_MASTER_LINKS_END}`
  const text = String(notes ?? '').trim()
  const pattern = new RegExp(
    `${PRODUCT_MASTER_LINKS_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${PRODUCT_MASTER_LINKS_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
    'g'
  )

  if (!text) return metadataBlock
  if (pattern.test(text)) return text.replace(pattern, metadataBlock)
  return `${text}\n\n${metadataBlock}`
}

export function resolveLinkedProductMaster(
  mobileOrderProductId: string,
  links: Record<string, MobileOrderProductMasterLink>,
  productMasterById: Map<string, ProductMasterRow>
) {
  const link = links[mobileOrderProductId]
  if (!link) return null

  const productMaster = productMasterById.get(link.product_master_id)
  if (!productMaster) return null

  return {
    link,
    productMaster,
  }
}

export async function loadPrimaryStoreOrderPageForVendor(supabase: any, userId: string) {
  const { data: store } = await (supabase as any)
    .from('vendor_stores')
    .select('id')
    .eq('vendor_user_id', userId)
    .maybeSingle()

  if (!store?.id) {
    return {
      storeId: null,
      orderPage: null as StoreOrderPageRow | null,
    }
  }

  const { data: orderPages } = await (supabase as any)
    .from('store_order_pages')
    .select('*')
    .eq('store_id', store.id)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1)

  return {
    storeId: store.id as string,
    orderPage: ((orderPages ?? [])[0] as StoreOrderPageRow | undefined) ?? null,
  }
}

export async function loadProductMasterCostContext(supabase: any, userId: string) {
  const [{ data: productMasters, error: productMasterError }, storePage] = await Promise.all([
    (supabase as any).from('product_master').select('*').eq('user_id', userId).order('product_name', { ascending: true }),
    loadPrimaryStoreOrderPageForVendor(supabase, userId),
  ])

  if (productMasterError) {
    throw new Error(productMasterError.message)
  }

  const rows = (productMasters ?? []) as ProductMasterRow[]
  const byId = new Map(rows.map((row) => [row.id, row]))
  const byName = new Map(rows.map((row) => [row.product_name, row]))
  const metadata = extractProductMasterLinksFromNotes(storePage.orderPage?.notes ?? null)
  const links = metadata?.mobile_order_product_links ?? {}
  const optionChoiceLinks = metadata?.mobile_order_option_choice_links ?? {}

  return {
    rows,
    byId,
    byName,
    links,
    optionChoiceLinks,
    storeId: storePage.storeId,
    orderPage: storePage.orderPage,
  }
}

export function resolveCostForMobileOrderProduct(
  productId: string | null | undefined,
  productName: string,
  context: {
    byId: Map<string, ProductMasterRow>
    byName: Map<string, ProductMasterRow>
    links: Record<string, MobileOrderProductMasterLink>
  }
) {
  const linked =
    productId && context.links[productId]
      ? context.byId.get(context.links[productId].product_master_id) ?? null
      : null

  if (linked) {
    return linked
  }

  return context.byName.get(productName) ?? null
}

export function calculateCostFromProductMaster(
  productMaster: Pick<ProductMasterRow, 'cost_amount' | 'cost_rate'> | null | undefined,
  quantity: number,
  salesAmount: number
) {
  if (!productMaster) return 0
  if (productMaster.cost_amount != null) return productMaster.cost_amount * quantity
  if (productMaster.cost_rate != null) return (salesAmount * productMaster.cost_rate) / 100
  return 0
}

export function resolveCostForMobileOrderOptionChoice(
  optionChoiceId: string | null | undefined,
  optionChoiceName: string,
  context: {
    byId: Map<string, ProductMasterRow>
    byName: Map<string, ProductMasterRow>
    optionChoiceLinks: Record<string, MobileOrderProductMasterLink>
  }
) {
  const linked =
    optionChoiceId && context.optionChoiceLinks[optionChoiceId]
      ? context.byId.get(context.optionChoiceLinks[optionChoiceId].product_master_id) ?? null
      : null

  if (linked) return linked
  return context.byName.get(optionChoiceName) ?? null
}
