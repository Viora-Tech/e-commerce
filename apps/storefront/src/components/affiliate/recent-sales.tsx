import { formatPaise } from '@commerce/blocks'
import { formatInZone } from '@commerce/dates'
import type { PortalSale } from '@commerce/plugin-affiliates/server'
import { affiliateContent } from '@/data/affiliate'

type RecentSalesProps = { sales: PortalSale[] }

const copy = affiliateContent.dashboard

/** The words under a sale: where it stands (payable from, being checked, why not earned). */
function standing(s: PortalSale): string {
  if (s.status === 'reversed') {
    return copy.sale.reversed[s.reversedReason ?? ''] ?? copy.status.reversed ?? ''
  }
  if (s.held) return copy.sale.held
  if (s.status === 'pending' && s.eligibleAt) {
    return copy.sale.clears(formatInZone(s.eligibleAt, { dateStyle: 'medium' }))
  }
  return copy.status[s.status] ?? s.status
}

/** Their newest referred orders: when, a masked buyer, the sale, the commission and its stage. */
export default function RecentSales({ sales }: RecentSalesProps) {
  // Render logic
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="h3">{copy.recent}</h2>
        <p className="text-small text-muted">{copy.recentHelp}</p>
      </div>
      {sales.length === 0 ? (
        <p className="rounded-[var(--radius-card)] bg-surface p-5 text-body text-muted">
          {copy.recentEmpty}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-[var(--radius-card)] border border-line">
          {sales.map((s) => (
            <li key={s.id} className="flex items-start justify-between gap-4 p-4">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-body font-medium">
                  {s.buyer ?? copy.sale.buyer}
                  <span className="font-normal text-muted">
                    {' · '}
                    {formatInZone(s.placedAt, { dateStyle: 'medium' })}
                  </span>
                </span>
                <span className="text-small text-muted">
                  {copy.sale.source[s.source]} · {copy.sale.sale(formatPaise(s.basePaise))}
                </span>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
                <span
                  className={`text-body font-semibold tabular-nums ${
                    s.status === 'reversed' ? 'text-muted line-through' : ''
                  }`}
                >
                  {formatPaise(s.commissionPaise)}
                </span>
                <span className="text-small text-muted">{standing(s)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
