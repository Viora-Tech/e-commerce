import { formatPaise } from '@commerce/blocks'
import { formatInZone } from '@commerce/dates'
import type { AffiliateTotals, PayoutOutlook } from '@commerce/plugin-affiliates/server'
import { affiliateContent } from '@/data/affiliate'

type BalancesCardProps = { totals: AffiliateTotals; outlook: PayoutOutlook }

const copy = affiliateContent.dashboard

/** The lines under the balances: a payout on its way, what is ready, what holds it, what clears next. */
function outlookLines(o: PayoutOutlook): string[] {
  const lines: string[] = []
  if (o.processingPaise > 0) lines.push(copy.outlook.processing(formatPaise(o.processingPaise)))
  if (o.readyPaise > 0 && !o.blocker) lines.push(copy.outlook.ready(formatPaise(o.readyPaise)))
  if (o.blocker === 'below_minimum') lines.push(copy.outlook.below(formatPaise(o.minPayoutPaise)))
  if (o.blocker === 'no_details') lines.push(copy.outlook.noDetails)
  if (o.blocker === 'no_pan') lines.push(copy.outlook.noPan)
  if (o.blocker === 'review') lines.push(copy.outlook.review)
  if (o.nextClear) {
    lines.push(
      copy.outlook.nextClear(
        formatPaise(o.nextClear.paise),
        formatInZone(o.nextClear.at, { dateStyle: 'medium' }),
      ),
    )
  }
  return lines.length ? lines : [copy.outlook.nothing]
}

/** What they have pending, ready and paid, and what their next payout looks like. */
export default function BalancesCard({ totals: t, outlook }: BalancesCardProps) {
  // Render logic
  const b = copy.balances
  const tiles = [
    { label: b.pending, value: t.pendingPaise, hint: b.pendingHint },
    { label: b.approved, value: t.approvedPaise, hint: b.approvedHint },
    { label: b.paid, value: t.paidPaise, hint: b.paidHint },
  ]

  return (
    <section className="flex flex-col gap-4 rounded-[var(--radius-card)] border border-line p-5 sm:p-6">
      <h2 className="h3">{b.title}</h2>
      <dl className="grid gap-4 sm:grid-cols-3">
        {tiles.map((x) => (
          <div key={x.label} className="flex flex-col gap-0.5">
            <dt className="text-small text-muted">{x.label}</dt>
            <dd className="h4 tabular-nums">{formatPaise(x.value)}</dd>
            <dd className="text-small text-muted">{x.hint}</dd>
          </div>
        ))}
      </dl>
      <ul className="flex flex-col gap-1 border-t border-line pt-4 text-body">
        {outlookLines(outlook).map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
    </section>
  )
}
