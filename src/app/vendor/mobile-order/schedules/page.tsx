import { redirect } from 'next/navigation'
import VendorMobileOrderSchedulesPageClient from '@/components/VendorMobileOrderSchedulesPageClient'
import { requireServerSession } from '@/lib/auth'
import { loadVendorMobileOrderSchedulesPayload } from '@/lib/vendor-mobile-order-admin'

export default async function VendorMobileOrderSchedulesPage() {
  const { supabase, user, role } = await requireServerSession({ includeProfile: false })
  if (role !== 'vendor') {
    redirect('/')
  }

  const { data: vendorProfile } = await (supabase as any)
    .from('vendor_profiles')
    .select('business_name')
    .eq('user_id', user.id)
    .maybeSingle()

  const initialData = await loadVendorMobileOrderSchedulesPayload(supabase, user, vendorProfile?.business_name ?? null)

  return <VendorMobileOrderSchedulesPageClient initialData={initialData} />
}
