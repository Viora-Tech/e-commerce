import { formatPaise } from '@commerce/blocks'
import type { ShopperPointsEntry } from '@commerce/core'
import CheckoutIcon from '@/components/checkout/checkout-icon'
import { formatAccountDate } from '@/data/account'
import { loyaltyAccountContent } from '@/data/loyalty'
import {
  ACCOUNT_CARD,
  ACCOUNT_CARD_TITLE,
  ACCOUNT_INTRO,
  ACCOUNT_ROW,
  ACCOUNT_ROWS,
} from '@/lib/account-classes'

type PointsHistoryProps = {
  points: number
  expiringSoon: { points: number; lastDay: string } | null
  pendingPoints: number
  /** Saved as `MM-DD`; null when the shopper has not added it. */
  birthday: string | null
  entries: ShopperPointsEntry[]
  timeZone: string
}

const copy = loyaltyAccountContent

/** Paise per point. */
const POINT_PAISE = 100

/** A day already in store time (`YYYY-MM-DD`) in words; noon UTC keeps the day. */
const lastDay = (day: string) => formatAccountDate(`${day}T12:00:00Z`, 'UTC')

/** What a line was, in the shopper's words: never the reason staff typed. */
function describe(e: ShopperPointsEntry): string {
  if (e.source === 'order') return copy.sources.order(e.orderNumber)
  if (e.source === 'reversal') return copy.sources.reversal(e.orderNumber)
  return copy.sources[e.source]
}

/** "12 March" for a saved `MM-DD`. */
function birthdayLabel(mmdd: string): string {
  const [m, d] = mmdd.split('-').map(Number) as [number, number]
  return `${d} ${copy.months[m - 1] ?? ''}`
}

/** The day under a line: when it lands, why it never did, or when it came. */
function lineDay(e: ShopperPointsEntry, timeZone: string): string {
  if (e.status === 'pending') {
    return copy.statuses.pending(formatAccountDate(e.availableAt, timeZone))
  }
  if (e.status === 'cancelled') return copy.statuses.cancelled
  const day = formatAccountDate(e.createdAt, timeZone)
  return e.expiresOn ? `${day} · ${copy.usableUntil(lastDay(e.expiresOn))}` : day
}

/**
 * The account's Points page: the points on a card (with what they are worth, what runs out soon
 * and what is on the way), the birthday once added, then every change with its day.
 */
export default function PointsHistory({
  points,
  expiringSoon,
  pendingPoints,
  birthday,
  entries,
  timeZone,
}: PointsHistoryProps) {
  // Render logic
  return (
    <div className="flex max-w-[40rem] flex-col gap-4">
      <section className={`${ACCOUNT_CARD} gap-2!`} aria-labelledby="points-balance">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ck-accent-soft text-ck-accent">
            <CheckoutIcon name="gift" className="size-5" />
          </span>
          <p id="points-balance" className="text-[0.875rem] font-medium text-ck-muted">
            {copy.balance}
          </p>
        </div>
        <p className="text-[2rem] font-bold leading-tight tabular-nums text-ck-ink">
          {copy.points(points)}
        </p>
        <p className="text-[0.9375rem] text-ck-ink">
          {copy.worth(formatPaise(points * POINT_PAISE))}
        </p>
        {expiringSoon ? (
          <p className="text-[0.875rem] font-medium text-ck-danger">
            {copy.expiring(copy.points(expiringSoon.points), lastDay(expiringSoon.lastDay))}
          </p>
        ) : null}
        {pendingPoints > 0 ? (
          <p className="text-[0.875rem] text-ck-muted">
            {copy.pending(copy.points(pendingPoints))}
          </p>
        ) : null}
        {birthday ? (
          <p className="text-[0.875rem] text-ck-muted">
            {copy.birthday.saved(birthdayLabel(birthday))} · {copy.birthday.savedNote}
          </p>
        ) : null}
        <p className={ACCOUNT_INTRO}>{copy.intro}</p>
      </section>
      <section className={`${ACCOUNT_CARD} gap-1!`} aria-labelledby="points-history">
        <h2 id="points-history" className={ACCOUNT_CARD_TITLE}>
          {copy.history}
        </h2>
        {entries.length === 0 ? (
          <p className={`${ACCOUNT_INTRO} py-2`}>{copy.empty}</p>
        ) : (
          <ul className={ACCOUNT_ROWS}>
            {entries.map((e) => (
              <li key={e.id} className={ACCOUNT_ROW}>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[0.9375rem] text-ck-ink">{describe(e)}</span>
                  <span className="text-[0.8125rem] text-ck-muted">{lineDay(e, timeZone)}</span>
                </span>
                <span
                  className={`shrink-0 text-[0.9375rem] font-semibold tabular-nums ${e.status === 'cancelled' ? 'text-ck-muted line-through' : e.points > 0 ? 'text-ck-success' : 'text-ck-ink'}`}
                >
                  {e.points > 0 ? '+' : '−'}
                  {Math.abs(e.points)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
