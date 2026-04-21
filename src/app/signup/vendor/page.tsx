import RoleSignupPage from '@/components/RoleSignupPage'

export default function VendorSignupPage({
  searchParams,
}: {
  searchParams?: { from?: string; offer?: string }
}) {
  return <RoleSignupPage role="vendor" source={searchParams?.from ?? null} returnOfferId={searchParams?.offer ?? null} />
}
