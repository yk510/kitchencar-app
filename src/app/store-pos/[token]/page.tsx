import { notFound } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase'
import { applyStorePosSettingsToStore } from '@/lib/store-pos-settings'
import StorePosPageClient from '@/components/StorePosPageClient'
import type { PublicMobileOrderPagePayload } from '@/types/api-payloads'

type StorePosPageProps = {
  params: {
    token: string
  }
}

export default async function StorePosPage({ params }: StorePosPageProps) {
  const supabase = createServerSupabaseClient()
  const token = String(params.token ?? '').trim()

  if (!token) {
    notFound()
  }

  const { data: orderPage, error: pageError } = await (supabase as any)
    .from('store_order_pages')
    .select('*, vendor_stores!inner(*)')
    .eq('public_token', token)
    .eq('status', 'published')
    .maybeSingle()

  if (pageError || !orderPage?.vendor_stores) {
    notFound()
  }

  const store = applyStorePosSettingsToStore(orderPage.vendor_stores, orderPage)

  const { data: schedules, error: schedulesError } = await (supabase as any)
    .from('store_order_schedules')
    .select('*')
    .eq('store_id', store.id)
    .order('opens_at', { ascending: true })

  if (schedulesError) {
    throw new Error(schedulesError.message)
  }

  const activeSchedule =
    (schedules ?? []).find((schedule: any) => {
      if (!['scheduled', 'open'].includes(schedule.status)) return false
      const now = Date.now()
      const startsAt = new Date(schedule.opens_at).getTime()
      const endsAt = new Date(schedule.closes_at).getTime()
      return startsAt <= now && now < endsAt
    }) ?? null

  const nextSchedule =
    (schedules ?? []).find((schedule: any) => new Date(schedule.opens_at).getTime() > Date.now()) ?? null

  const { data: products, error: productsError } = await (supabase as any)
    .from('mobile_order_products')
    .select('*')
    .eq('store_id', store.id)
    .eq('is_published', true)
    .order('sort_order', { ascending: true })

  if (productsError) {
    throw new Error(productsError.message)
  }

  const payload: PublicMobileOrderPagePayload = {
    store,
    orderPage,
    activeSchedule,
    nextSchedule,
    products: (products ?? []).map((product: any) => ({
      ...product,
      option_groups: [],
      current_schedule_inventory_id: null,
      current_initial_quantity: null,
      current_adjustment_total: 0,
      current_available_quantity: null,
      current_ordered_quantity: 0,
      current_remaining_quantity: null,
      current_inventory_status: product.is_sold_out ? 'sold_out' : 'unmanaged',
    })),
  }

  return <StorePosPageClient data={payload} />
}
