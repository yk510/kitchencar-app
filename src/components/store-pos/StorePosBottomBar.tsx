import { formatPublicOrderPrice } from '@/lib/public-order-display'

type StorePosBottomBarProps = {
  cartSummary: string
  cartTotal: number
  totalItems: number
  hasCartItems: boolean
  confirmingPage: boolean
  onClearCart: () => void
  onOpenConfirmPage: () => void
}

export default function StorePosBottomBar({
  cartSummary,
  cartTotal,
  totalItems,
  hasCartItems,
  confirmingPage,
  onClearCart,
  onOpenConfirmPage,
}: StorePosBottomBarProps) {
  return (
    <section className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-4 md:px-6">
      <div className="pointer-events-auto mx-auto max-w-7xl rounded-[28px] border border-[var(--line-soft)] bg-white/95 px-4 py-4 shadow-[0_-12px_40px_rgba(15,23,42,0.12)] backdrop-blur md:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">注文内容の確認</p>
            <p className="mt-1 truncate text-sm font-medium text-slate-500">{cartSummary}</p>
            <div className="mt-2 flex flex-wrap items-center gap-4">
              <p className="text-lg font-black text-[var(--text-main)]">{formatPublicOrderPrice(cartTotal)}</p>
              <p className="text-sm font-semibold text-slate-500">{totalItems} 点</p>
              <p className="text-sm font-semibold text-slate-500">お支払い方法は次の確認ページで選択します</p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onClearCart}
              disabled={!hasCartItems || confirmingPage}
              className="inline-flex items-center justify-center rounded-[24px] bg-white px-5 py-4 text-base font-semibold text-slate-600 ring-1 ring-[var(--line-soft)] transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              カートを空にする
            </button>
            <button
              type="button"
              onClick={onOpenConfirmPage}
              disabled={!hasCartItems || confirmingPage}
              className="inline-flex min-w-[220px] items-center justify-center rounded-[24px] bg-[var(--accent-blue)] px-6 py-4 text-lg font-bold text-white shadow-[0_18px_40px_rgba(37,99,235,0.3)] transition hover:brightness-[1.03] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {confirmingPage ? '確認ページを開いています...' : '注文を確認する'}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
