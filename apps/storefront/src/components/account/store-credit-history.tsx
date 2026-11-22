import { formatPaise } from '@commerce/blocks'
import type { ShopperStoreCreditEntry } from '@commerce/core'
import CheckoutIcon from '@/components/checkout/checkout-icon'
import { accountContent, formatAccountDate } from '@/data/account'
import {
  ACCOUNT_CARD,
  ACCOUNT_CARD_TITLE,
  ACCOUNT_INTRO,
  ACCOUNT_ROW,
  ACCOUNT_ROWS,
} from '@/lib/account-classes'

type StoreCreditHistoryProps = {
  balancePaise: number
  entries: ShopperStoreCreditEntry[]
  timeZone: string
}

const copy = accountContent.storeCredit

/** A credit's last day (`YYYY-MM-DD`, already in store time) in words; noon UTC keeps the day. */
const lastDay = (day: string) => formatAccountDate(`${day}T12:00:00Z`, 'UTC')

/** What a change was, in the shopper's words: never the reason staff typed. */
export function describeStoreCredit(e: ShopperStoreCreditEntry): string {
  if (e.kind === 'payment') return copy.used(e.orderNumber)
  if (e.kind === 'refund') return copy.refund(e.orderNumber)
  if (e.kind === 'release') return copy.returned(e.orderNumber)
  if (e.kind === 'expiry') return copy.expired
  if (e.kind === 'loyalty') return copy.loyalty(e.amountPaise)
  return e.amountPaise > 0 ? copy.added : copy.removed
}

/** A change as a signed amount: "+₹500.00" in the success colour, "−₹200.00" in ink. */
export function signedStoreCredit(amountPaise: number): string {
  return `${amountPaise > 0 ? '+' : '−'}${formatPaise(Math.abs(amountPaise))}`
}

/**
 * The account's Store credit page: the balance the shop holds for the shopper on a card, then
 * each change with its order and day. Read-only; it is spent at checkout.
 */
export default function StoreCreditHistory({
  balancePaise,
  entries,
  timeZone,
}: StoreCreditHistoryProps) {
  // Render logic
  return (
    <div className="flex max-w-[40rem] flex-col gap-4">
      <section className={`${ACCOUNT_CARD} gap-2!`} aria-labelledby="credit-balance">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ck-accent-soft text-ck-accent">
            <CheckoutIcon name="gift" className="size-5" />
          </span>
          <p id="credit-balance" className="text-[0.875rem] font-medium text-ck-muted">
            {copy.balance}
          </p>
        </div>
        <p className="text-[2rem] font-bold leading-tight tabular-nums text-ck-ink">
          {formatPaise(balancePaise)}
        </p>
        <p className={ACCOUNT_INTRO}>{copy.intro}</p>
      </section>
      <section className={`${ACCOUNT_CARD} gap-1!`} aria-labelledby="credit-history">
        <h2 id="credit-history" className={ACCOUNT_CARD_TITLE}>
          {copy.history}
        </h2>
        {entries.length === 0 ? (
          <p className={`${ACCOUNT_INTRO} py-2`}>{copy.empty}</p>
        ) : (
          <ul className={ACCOUNT_ROWS}>
            {entries.map((e) => (
              <li key={e.id} className={ACCOUNT_ROW}>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[0.9375rem] text-ck-ink">{describeStoreCredit(e)}</span>
                  <span className="text-[0.8125rem] text-ck-muted">
                    {formatAccountDate(e.createdAt, timeZone)}
                    {e.expiresOn ? ` · ${copy.expiresOn(lastDay(e.expiresOn))}` : ''}
                  </span>
                </span>
                <span
                  className={`shrink-0 text-[0.9375rem] font-semibold tabular-nums ${e.amountPaise > 0 ? 'text-ck-success' : 'text-ck-ink'}`}
                >
                  {signedStoreCredit(e.amountPaise)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
