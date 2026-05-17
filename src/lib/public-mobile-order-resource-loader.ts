import { applyStorePosSettingsToStore } from '@/lib/store-pos-settings'
import type {
  MobileOrderOptionChoiceRow,
  MobileOrderOptionGroupRow,
  MobileOrderProductRow,
  PublicMobileOrderPagePayload,
  StoreOrderScheduleRow,
} from '@/types/api-payloads'

export type PublishedOrderResources = {
  store: PublicMobileOrderPagePayload['store']
  orderPage: PublicMobileOrderPagePayload['orderPage']
  schedules: StoreOrderScheduleRow[]
  products: MobileOrderProductRow[]
  optionGroups: MobileOrderOptionGroupRow[]
  optionChoices: MobileOrderOptionChoiceRow[]
  links: Array<{ product_id: string; option_group_id: string }>
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
