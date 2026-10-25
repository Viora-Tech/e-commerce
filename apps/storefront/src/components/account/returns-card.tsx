import { formatPaise } from '@commerce/blocks'
import type { OrderReturnState } from '@commerce/core'
import Link from 'next/link'
import { formatAccountDate } from '@/data/account'
import { returnsContent } from '@/data/returns'
import ReturnTimeline from './return-timeline'
import StatusPill from './status-pill'

type ReturnsCardProps = {
  state: OrderReturnState
  orderNumber: number
  timeZone: string
  /** Set right after the shopper sent a request. */
  justSent: boolean
}

const copy = returnsContent.card

type Shopper = OrderReturnState['returns'][number]

function windowLine(state: OrderReturnState, timeZone: string): string {
  const e = state.eligibility
  const closes = e.closesAt ? formatAccountDate(e.closesAt, timeZone) : ''
  switch (e.why) {
    case 'ok':
      return copy.openUntil(closes, e.daysLeft ?? 0)
    case 'window_closed':
      return copy.closed(closes)
    case 'disabled':
      return copy.disabled
    case 'cancelled':
      return copy.cancelled
    case 'nothing_left':
      return copy.nothingLeft
    default:
      return copy.notDelivered
  }
}

function outcome(r: Shopper): string | null {
  if (r.status === 'rejected' && r.decisionNote) return copy.declined(r.decisionNote)
  if (r.status === 'resolved') {
    const amount = formatPaise(r.refundAmountPaise ?? 0)
    if (r.resolution === 'refund') return copy.refunded(amount)
    if (r.resolution === 'store_credit') return copy.credited(amount)
    if (r.resolution === 'exchange') return copy.exchanged
    return null
  }
  if (r.status === 'in_transit' || r.status === 'approved') {
    if (r.pickupMethod === 'courier' && r.pickupWaybill) return copy.pickup(r.pickupWaybill)
    if (r.pickupMethod === 'customer') return copy.shipYourself
  }
  return null
}

const tone = (r: Shopper) =>
  r.status === 'rejected' || r.status === 'cancelled'
    ? 'bad'
    : r.status === 'resolved'
      ? 'good'
      : 'neutral'

/** The order page's returns section: the window, a start button, and every return so far. */
export default function ReturnsCard({ state, orderNumber, timeZone, justSent }: ReturnsCardProps) {
  // Render logic
  // RTO tasks are the shop's business; shoppers only see their own requests.
  const returns = state.returns.filter((r) => r.kind === 'return')

  return (
    <section
      className="flex flex-col gap-4 rounded-[var(--radius-card)] bg-surface p-6"
      aria-labelledby="order-returns"
    >
      <h3 id="order-returns" className="h4">
        {copy.title}
      </h3>
      {justSent ? (
        <p className="text-body text-success" role="status">
          {copy.sent}
        </p>
      ) : null}
      <p className="text-body text-muted">{windowLine(state, timeZone)}</p>
      {state.eligibility.open ? (
        <Link
          href={`/account/orders/${orderNumber}/return`}
          className="btn btn--primary self-start"
        >
          <span className="btn__label">{copy.start}</span>
        </Link>
      ) : null}
      {returns.length > 0 ? (
        <ul className="flex flex-col divide-y divide-line">
          {returns.map((r) => {
            const note = outcome(r)
            return (
              <li key={r.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-body font-medium">
                    {r.label} · {copy.items(r.lines.reduce((n, l) => n + l.returnQuantity, 0))}
                  </span>
                  <StatusPill label={returnsContent.status[r.status]} tone={tone(r)} />
                </div>
                <ul className="flex flex-col gap-1 text-small text-muted">
                  {r.lines.map((l) => (
                    <li key={l.returnLineId}>
                      {l.title}
                      {l.variantTitle && l.variantTitle !== 'Default' ? ` / ${l.variantTitle}` : ''}{' '}
                      × {l.returnQuantity}
                    </li>
                  ))}
                </ul>
                {note ? <p className="text-small">{note}</p> : null}
                <ReturnTimeline row={r} timeZone={timeZone} />
              </li>
            )
          })}
        </ul>
      ) : null}
    </section>
  )
}
