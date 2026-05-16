'use client'

type VendorMobileOrderDashboardAlertsProps = {
  error: string | null
  message: string | null
  notificationBanner: string | null
}

export function VendorMobileOrderDashboardAlerts({
  error,
  message,
  notificationBanner,
}: VendorMobileOrderDashboardAlertsProps) {
  if (!error && !message && !notificationBanner) return null

  return (
    <>
      {error ? <p className="alert-danger px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {message ? (
        <p className="rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{message}</p>
      ) : null}
      {notificationBanner ? (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
          {notificationBanner}
        </p>
      ) : null}
    </>
  )
}
