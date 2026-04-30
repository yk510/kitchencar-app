import { Suspense } from 'react'
import LiffMobileOrderEntryClient from '@/components/LiffMobileOrderEntryClient'

export const dynamic = 'force-dynamic'

export default function LiffMobileOrderPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-2xl px-4 py-16">
          <div className="soft-panel rounded-[32px] p-8 text-center text-sm text-[var(--text-sub)]">
            LIFFの入口ページを準備しています...
          </div>
        </div>
      }
    >
      <LiffMobileOrderEntryClient />
    </Suspense>
  )
}
