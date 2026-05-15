'use client'

export default function LoadingLine({
  label,
  className = '',
}: {
  label?: string
  className?: string
}) {
  return (
    <div className={className}>
      {label ? <p className="text-sm font-medium text-[var(--text-sub)]">{label}</p> : null}
      <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-[var(--accent-blue-soft)]">
        <div className="loading-line-segment absolute inset-y-0 left-0 w-1/3 rounded-full bg-[var(--accent-blue)]" />
      </div>
      <style jsx>{`
        .loading-line-segment {
          animation: loading-slide 1.2s ease-in-out infinite;
        }

        @keyframes loading-slide {
          0% {
            transform: translateX(-110%) scaleX(0.7);
            opacity: 0.7;
          }
          50% {
            transform: translateX(120%) scaleX(1.05);
            opacity: 1;
          }
          100% {
            transform: translateX(330%) scaleX(0.7);
            opacity: 0.7;
          }
        }
      `}</style>
    </div>
  )
}
