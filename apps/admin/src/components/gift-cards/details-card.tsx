import Link from 'next/link'
import DataCard from '@/components/layout/data-card'
import KeyValueList from '@/components/layout/key-value-list'
import { giftCardDetailContent, giftCardsContent } from '@/data/gift-cards'
import { formatPattern } from '@/lib/format-date'
import { routes } from '@/lib/routes'

type DetailsCardProps = {
  card: {
    createdAt: Date | string
    createdBy: string | null
    source: 'manual' | 'purchase'
    orderId: string | null
    orderNumber: number | null
    deliveredAt: Date | string | null
    message: string | null
  }
}

const copy = giftCardDetailContent.details
const WHEN = {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
} as const

/** Where the card came from and whether its code has been emailed. */
export default function DetailsCard({ card }: DetailsCardProps) {
  return (
    <DataCard title={copy.heading}>
      <KeyValueList
        variant="grid"
        rows={[
          { label: copy.issued, value: formatPattern(card.createdAt, WHEN) },
          { label: copy.by, value: card.createdBy, hidden: !card.createdBy },
          {
            label: copy.source,
            value:
              card.source === 'purchase' && card.orderId ? (
                <Link
                  href={routes.orders.detail(card.orderId)}
                  className="text-link hover:underline"
                >
                  {giftCardsContent.source.purchase(card.orderNumber)}
                </Link>
              ) : (
                giftCardsContent.source.manual
              ),
          },
          {
            label: copy.delivered,
            value: card.deliveredAt ? formatPattern(card.deliveredAt, WHEN) : copy.notDelivered,
          },
          { label: copy.message, value: card.message, hidden: !card.message },
        ]}
      />
    </DataCard>
  )
}
