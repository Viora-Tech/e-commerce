import Link from 'next/link'
import DataCard from '@/components/layout/data-card'
import { returnDetailContent } from '@/data/returns'
import { formatPaise } from '@/lib/money'
import RestockButton from './restock-button'
import type { ReturnDetail } from './return-types'

type ReturnOutcomeCardProps = { detail: ReturnDetail; onChanged: () => void }

const copy = returnDetailContent.outcome

/** How a settled return ended, in one sentence, with a link to the exchange draft. */
export default function ReturnOutcomeCard({ detail: r, onChanged }: ReturnOutcomeCardProps) {
  // Render logic
  const amount = formatPaise(r.refundAmountPaise ?? 0)
  const text =
    r.resolution === 'refund'
      ? copy.refund(amount)
      : r.resolution === 'store_credit'
        ? copy.store_credit(amount, r.giftCard?.lastCharacters ?? null)
        : r.resolution === 'exchange'
          ? copy.exchange(r.exchangeOrder?.number ?? null)
          : r.resolution === 'reship'
            ? copy.reship
            : copy.none

  return (
    <DataCard
      title={copy.title}
      action={
        r.resolution === 'reship' ? undefined : <RestockButton detail={r} onChanged={onChanged} />
      }
    >
      <p className="text-body text-foreground">{text}</p>
      {r.exchangeOrder ? (
        <Link
          href={
            r.exchangeOrder.status === 'draft'
              ? `/orders/drafts/${r.exchangeOrder.id}`
              : `/orders/${r.exchangeOrder.id}`
          }
          className="mt-2 inline-block text-body text-link hover:underline"
        >
          {copy.openDraft}
        </Link>
      ) : null}
    </DataCard>
  )
}
