import DataCard from '@/components/layout/data-card'
import LineItemRow from '@/components/layout/line-item-row'
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
          <LineItemRow
            key={l.returnLineId}
            className="px-4 py-3 first:pt-3 last:pb-3 md:px-6"
            imageUrl={l.imageUrl}
            title={l.title}
            subtitle={[
              l.variantTitle !== 'Default' ? l.variantTitle : null,
              l.restockedQuantity > 0 ? copy.restocked(l.restockedQuantity) : null,
            ]
              .filter(Boolean)
              .join(' · ')}
            quantity={copy.quantity(l.returnQuantity)}
            amount={formatPaise(l.returnQuantity * l.unitPricePaise)}
          />
        ))}
      </ul>
    </DataCard>
  )
}
