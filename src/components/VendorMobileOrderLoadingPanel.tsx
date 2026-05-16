'use client'

type VendorMobileOrderLoadingPanelProps = {
  message?: string
}

export function VendorMobileOrderLoadingPanel({
  message = '読み込み中...',
}: VendorMobileOrderLoadingPanelProps) {
  return <div className="soft-panel p-6 text-sm text-gray-500">{message}</div>
}
