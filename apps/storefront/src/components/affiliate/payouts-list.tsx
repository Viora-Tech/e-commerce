import { formatPaise } from '@commerce/blocks'
import { formatInZone } from '@commerce/dates'
import type { PortalPayout } from '@commerce/plugin-affiliates/server'
import { affiliateContent } from '@/data/affiliate'

type PayoutsListProps = { payouts: PortalPayout[] }

const copy = affiliateContent.dashboard.payouts

/** How a payout was worked out: commission, less returned orders, plus GST, less TDS. */
function breakdown(p: PortalPayout) {
  return [
    { label: copy.gross, value: p.grossPaise, sign: '' },
    { label: copy.clawback, value: p.clawbackPaise, sign: '− ' },
    { label: copy.gst, value: p.gstPaise, sign: '+ ' },
    { label: copy.tds, value: p.tdsPaise, sign: '− ' },
  ].filter((x) => x.label === copy.gross || x.value > 0)
}

/** Their payouts: what reached them, when, the bank reference, and how it was worked out. */
export default function PayoutsList({ payouts }: PayoutsListProps) {
  // Render logic
  return (
    <section className="flex flex-col gap-3">
      <h2 className="h3">{copy.title}</h2>
      {payouts.length === 0 ? (
        <p className="text-body text-muted">{copy.empty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-[var(--radius-card)] border border-line">
          {payouts.map((p) => (
            <li key={p.id} className="flex flex-col gap-2 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-body font-medium">
                    {p.status === 'paid' && p.paidAt
                      ? copy.paid(formatInZone(p.paidAt, { dateStyle: 'medium' }))
                      : copy.processing}
                  </span>
                  {p.reference ? (
                    <span className="break-all text-small text-muted">
                      {copy.reference(p.reference)}
                    </span>
                  ) : null}
                </div>
                <span className="shrink-0 text-body font-semibold tabular-nums">
                  {formatPaise(p.netPaise)}
                </span>
              </div>
              <details className="text-small text-muted">
                <summary className="cursor-pointer">{copy.breakdown}</summary>
                <dl className="mt-2 flex flex-col gap-1">
                  {breakdown(p).map((x) => (
                    <div key={x.label} className="flex justify-between gap-4">
                      <dt>{x.label}</dt>
                      <dd className="tabular-nums">
                        {x.sign}
                        {formatPaise(x.value)}
                      </dd>
                    </div>
                  ))}
                  <div className="flex justify-between gap-4 font-medium text-ink">
                    <dt>{copy.net}</dt>
                    <dd className="tabular-nums">{formatPaise(p.netPaise)}</dd>
                  </div>
                </dl>
              </details>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
