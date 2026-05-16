import {
  formatPublicOrderItemMeta,
  formatPublicOrderOptionGroupLine,
  formatPublicOrderPrice,
  type PublicOrderDisplayItem,
} from '@/lib/public-order-display'

type PublicOrderItemsPanelProps = {
  title: string
  description?: string
  items: PublicOrderDisplayItem[]
  itemKeyPrefix: string
  totalItems?: number
  panelClassName?: string
  itemClassName?: string
  titleClassName?: string
  descriptionClassName?: string
  countBadgeClassName?: string
  amountClassName?: string
  metaClassName?: string
  optionsClassName?: string
}

export default function PublicOrderItemsPanel({
  title,
  description,
  items,
  itemKeyPrefix,
  totalItems,
  panelClassName = '',
  itemClassName = 'rounded-[24px] bg-[#f8fbff] px-5 py-4 ring-1 ring-[var(--line-soft)]',
  titleClassName = 'text-xl font-black text-[var(--text-main)]',
  descriptionClassName = 'mt-1 text-sm text-[var(--text-sub)]',
  countBadgeClassName = 'rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600',
  amountClassName = 'whitespace-nowrap text-xl font-black text-[var(--accent-blue)]',
  metaClassName = 'mt-1 text-sm text-[var(--text-sub)]',
  optionsClassName = 'mt-3 space-y-1 text-sm text-[var(--text-sub)]',
}: PublicOrderItemsPanelProps) {
  return (
    <section className={panelClassName}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className={titleClassName}>{title}</h2>
          {description ? <p className={descriptionClassName}>{description}</p> : null}
        </div>
        {typeof totalItems === 'number' ? <div className={countBadgeClassName}>{totalItems} 点</div> : null}
      </div>

      <div className="mt-5 space-y-4">
        {items.map((item) => (
          <div key={`${itemKeyPrefix}-${item.id}`} className={itemClassName}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-lg font-bold text-[var(--text-main)]">{item.product_name}</p>
                <p className={metaClassName}>{formatPublicOrderItemMeta(item)}</p>
                {item.selected_options.length > 0 ? (
                  <div className={optionsClassName}>
                    {item.selected_options.map((group) => (
                      <p key={`${itemKeyPrefix}-${item.id}-${group.group_id}`}>
                        {formatPublicOrderOptionGroupLine(group)}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
              <p className={amountClassName}>{formatPublicOrderPrice(item.line_total)}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
