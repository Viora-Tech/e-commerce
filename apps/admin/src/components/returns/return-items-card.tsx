import { cn } from '@commerce/ui/lib/utils'
import DataCard from '@/components/layout/data-card'
import { returnDetailContent as copy } from '@/data/returns'
import { formatPaise } from '@/lib/money'
import type { ReturnDetail } from './return-types'

type ReturnItemsCardProps = { detail: ReturnDetail }

/** The lines going back: picture, name, quantity, value, and how many are back in stock. */
export default function ReturnItemsCard({ detail: r }: ReturnItemsCardProps) {
  // Render logic
  const title = r.kind === 'rto' ? copy.rtoItems : copy.items

  return (
    <DataCard title={title} flush>
      <ul className="flex flex-col divide-y divide-border">
        {r.lines.map((l) => (
          <li key={l.returnLineId} className="flex items-center gap-3 px-4 py-3 md:px-6">
            <span
              className={cn(
                'flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border',
                l.imageUrl ? 'bg-media' : 'bg-card',
              )}
            >
              {l.imageUrl ? (
                // biome-ignore lint/performance/noImgElement: remote store media, sized by the row.
                <img src={l.imageUrl} alt="" className="size-9 object-contain" />
              ) : null}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="line-clamp-1 text-body text-foreground">{l.title}</span>
              <span className="text-caption text-muted-foreground">
                {[
                  l.variantTitle !== 'Default' ? l.variantTitle : null,
                  copy.quantity(l.returnQuantity),
                ]
                  .filter(Boolean)
                  .join(' · ')}
                {l.restockedQuantity > 0 ? ` · ${copy.restocked(l.restockedQuantity)}` : ''}
              </span>
            </span>
            <span className="text-body tabular-nums">
              {formatPaise(l.returnQuantity * l.unitPricePaise)}
            </span>
          </li>
        ))}
      </ul>
    </DataCard>
  )
}
