import { Card } from '@commerce/ui/shadcn/card'
import Link from 'next/link'
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-caption text-muted-foreground">{label}</span>
      <span className="text-body text-foreground">{children}</span>
    </div>
  )
}

/** Where the card came from and whether its code has been emailed. */
export default function DetailsCard({ card }: DetailsCardProps) {
  return (
    <Card gap={3} inset={5}>
      <p className="text-card-title text-foreground">{copy.heading}</p>
      <Row label={copy.issued}>{formatPattern(card.createdAt, WHEN)}</Row>
      {card.createdBy ? <Row label={copy.by}>{card.createdBy}</Row> : null}
      <Row label={copy.source}>
        {card.source === 'purchase' && card.orderId ? (
          <Link href={routes.orders.detail(card.orderId)} className="text-link hover:underline">
            {giftCardsContent.source.purchase(card.orderNumber)}
          </Link>
        ) : (
          giftCardsContent.source.manual
        )}
      </Row>
      <Row label={copy.delivered}>
        {card.deliveredAt ? formatPattern(card.deliveredAt, WHEN) : copy.notDelivered}
      </Row>
      {card.message ? <Row label={copy.message}>{card.message}</Row> : null}
    </Card>
  )
}
