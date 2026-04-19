export const AUTH_COOKIE_NAME = 'kitchencar-access-token'

export function getAuthCookieDomain() {
  return (
    process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN ??
    process.env.AUTH_COOKIE_DOMAIN ??
    null
  )
}
