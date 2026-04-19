type MarketplaceMessageItemProps = {
  label: string
  message: string
  createdAt: string
  align: 'left' | 'right' | 'center'
  tone: 'normal' | 'mine' | 'notice'
  highlighted?: boolean
}

export default function MarketplaceMessageItem({
  label,
  message,
  createdAt,
  align,
  tone,
  highlighted = false,
}: MarketplaceMessageItemProps) {
  const wrapperClass =
    align === 'center' ? 'mx-auto w-full max-w-full' : align === 'right' ? 'ml-auto' : ''

  const surfaceClass =
    tone === 'notice'
      ? 'border border-amber-200 bg-amber-50 text-amber-900'
      : tone === 'mine'
        ? 'bg-[var(--accent-blue)] text-white'
        : 'bg-[#f3f5f8] text-gray-700'

  const metaClass =
    tone === 'notice'
      ? 'text-amber-700'
      : tone === 'mine'
        ? 'text-blue-100'
        : 'text-gray-500'

  return (
    <div
      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${wrapperClass} ${surfaceClass} ${
        highlighted ? 'ring-2 ring-blue-200 ring-offset-2' : ''
      }`}
    >
      <p className={`text-[11px] font-semibold ${metaClass}`}>{label}</p>
      <p className={highlighted ? 'mt-1 font-semibold' : 'mt-1'}>{message}</p>
      <p className={`mt-2 text-[11px] ${metaClass}`}>{new Date(createdAt).toLocaleString('ja-JP')}</p>
    </div>
  )
}
