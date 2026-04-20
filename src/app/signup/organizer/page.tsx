import RoleSignupPage from '@/components/RoleSignupPage'

export default function OrganizerSignupPage({
  searchParams,
}: {
  searchParams?: { from?: string }
}) {
  return <RoleSignupPage role="organizer" source={searchParams?.from ?? null} />
}
