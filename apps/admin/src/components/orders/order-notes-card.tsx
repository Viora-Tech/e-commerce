import DataCard from '@/components/layout/data-card'
import { orderNotesCardContent } from '@/data/order-cards'
import { useCopy } from '@/hooks/use-copy'

type OrderNotesCardProps = {
  /** What the customer wrote at checkout; null or blank when nothing. */
  note: string | null
}

/** The order page's Notes card, under the customer as on Shopify: the checkout note, read-only. */
export default function OrderNotesCard({ note }: OrderNotesCardProps) {
  // Hooks
  const copy = useCopy(orderNotesCardContent)

  // Render logic
  const text = note?.trim()

  return (
    <DataCard title={copy.title}>
      {text ? (
        <p className="whitespace-pre-line break-words text-body">{text}</p>
      ) : (
        <p className="text-body text-muted-foreground">{copy.empty}</p>
      )}
    </DataCard>
  )
}
