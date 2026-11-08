import { formatPaise } from '@commerce/blocks'
import type { ShopperStoreCreditEntry } from '@commerce/core'
import { accountContent, formatAccountDate } from '@/data/account'

type StoreCreditHistoryProps = {
  balancePaise: number
  entries: ShopperStoreCreditEntry[]
  timeZone: string
}

const copy = accountContent.storeCredit

/** What a change was, in the shopper's words: never the reason staff typed. */
function describe(e: ShopperStoreCreditEntry): string {
  if (e.kind === 'payment') return copy.used(e.orderNumber)
  if (e.kind === 'refund') return copy.refund(e.orderNumber)
  if (e.kind === 'release') return copy.returned(e.orderNumber)
  return e.amountPaise > 0 ? copy.added : copy.removed
}

/**
 * The account's Store credit page: the balance the shop holds for the shopper, then each change
 * with its order and day. Read-only; it is spent at checkout.
 */
export default function StoreCreditHistory({
  balancePaise,
  entries,
  timeZone,
}: StoreCreditHistoryProps) {
  // Render logic
  return (
    <div className="flex max-w-[36rem] flex-col gap-8">
      <section className="flex flex-col gap-2 rounded-[var(--radius-card)] bg-surface p-6">
        <p className="text-small text-muted">{copy.balance}</p>
        <p className="h2 tabular-nums">{formatPaise(balancePaise)}</p>
        <p className="text-body text-muted">{copy.intro}</p>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="h4">{copy.history}</h2>
        {entries.length === 0 ? (
          <p className="text-body text-muted">{copy.empty}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-[var(--radius-card)] bg-surface">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 px-5 py-4">
                <span className="flex min-w-0 flex-col">
                  <span className="text-body">{describe(e)}</span>
                  <span className="text-small text-muted">
                    {formatAccountDate(e.createdAt, timeZone)}
                  </span>
                </span>
                <span className="shrink-0 text-body font-medium tabular-nums">
                  {e.amountPaise > 0 ? '+' : '−'}
                  {formatPaise(Math.abs(e.amountPaise))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
