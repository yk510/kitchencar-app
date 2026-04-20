import RoleSignupPage from '@/components/RoleSignupPage'

export default function VendorSignupPage({
  searchParams,
}: {
  searchParams?: { from?: string }
}) {
  return <RoleSignupPage role="vendor" source={searchParams?.from ?? null} />
}
