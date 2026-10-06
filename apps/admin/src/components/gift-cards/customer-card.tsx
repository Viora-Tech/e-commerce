import { Card } from '@commerce/ui/shadcn/card'
import Link from 'next/link'
import { giftCardDetailContent } from '@/data/gift-cards'

type CustomerCardProps = {
  card: {
    customerId: string | null
    customerName: string | null
    customerEmail: string | null
    recipientEmail: string | null
    recipientName: string | null
  }
}

const copy = giftCardDetailContent.customer

/** Who the card belongs to, and where its code was sent. */
export default function CustomerCard({ card }: CustomerCardProps) {
  // Render logic
  const recipient = card.recipientEmail && card.recipientEmail !== card.customerEmail

  return (
    <Card gap={3} inset={5}>
      <p className="text-card-title text-foreground">{copy.heading}</p>
      {card.customerId ? (
        <div className="flex flex-col gap-0.5">
          <Link
            href={`/customers/${card.customerId}`}
            className="text-body-strong text-link hover:underline"
          >
            {card.customerName || card.customerEmail}
          </Link>
          {card.customerName && card.customerEmail ? (
            <span className="text-caption text-muted-foreground">{card.customerEmail}</span>
          ) : null}
        </div>
      ) : (
        <p className="text-body text-muted-foreground">{copy.none}</p>
      )}
      {recipient ? (
        <div className="flex flex-col gap-0.5 border-t border-border pt-3">
          <span className="text-caption text-muted-foreground">{copy.recipient}</span>
          <span className="text-body text-foreground">
            {card.recipientName ? `${card.recipientName}, ` : ''}
            {card.recipientEmail}
          </span>
        </div>
      ) : null}
    </Card>
  )
}
