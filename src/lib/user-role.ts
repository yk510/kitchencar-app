export type AppRole = 'vendor' | 'organizer'

export function getHomePathByRole(role: AppRole | null | undefined) {
  return role === 'organizer' ? '/organizer' : '/'
}
