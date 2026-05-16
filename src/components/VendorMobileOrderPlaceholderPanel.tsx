'use client'

type VendorMobileOrderPlaceholderPanelProps = {
  message: string
  compact?: boolean
}

export function VendorMobileOrderPlaceholderPanel({
  message,
  compact = false,
}: VendorMobileOrderPlaceholderPanelProps) {
  return (
    <div
      className={`flex items-center justify-center rounded-3xl border border-dashed border-[var(--line-soft)] bg-white px-5 text-center text-sm text-gray-500 ${
        compact ? 'py-6' : 'h-full py-10'
      }`}
    >
      {message}
    </div>
  )
}
