import { formatPaise } from '@commerce/blocks'
import { formatInZone } from '@commerce/dates'
import CodeRequestForm from '@/components/affiliate/code-request-form'
import CopyValue from '@/components/affiliate/copy-value'
import CreativesList from '@/components/affiliate/creatives-list'
import EarningsTrend from '@/components/affiliate/earnings-trend'
import LinkBuilder from '@/components/affiliate/link-builder'
import PayoutDetailsForm from '@/components/affiliate/payout-details-form'
import { affiliateContent } from '@/data/affiliate'
import type { AffiliatePortal } from '@/lib/affiliates'

type AffiliateDashboardProps = {
  portal: AffiliatePortal & {
    affiliate: NonNullable<AffiliatePortal['affiliate']>
    totals: NonNullable<AffiliatePortal['totals']>
  }
  origin: string
}

const copy = affiliateContent.dashboard

/** An approved affiliate's link, code, link builder, figures, recent sales and payout details. */
export default function AffiliateDashboard({ portal, origin }: AffiliateDashboardProps) {
  // Render logic
  const { affiliate: a, totals: t } = portal
  const link = `${origin.replace(/\/+$/, '')}/?ref=${a.code}`
  const stats = [
    { label: copy.stats.clicks, value: String(t.clicks) },
    { label: copy.stats.orders, value: String(t.orders) },
    { label: copy.stats.pending, value: formatPaise(t.pendingPaise), hint: copy.stats.pendingHint },
    { label: copy.stats.approved, value: formatPaise(t.approvedPaise) },
    { label: copy.stats.paid, value: formatPaise(t.paidPaise) },
  ]

  return (
    <div className="flex flex-col gap-10">
      <h1 className="h2">{copy.title(a.name)}</h1>
      <div className="grid max-w-[48rem] gap-5 rounded-[var(--radius-card)] bg-surface p-6 md:grid-cols-2">
        <CopyValue label={copy.link} value={link} hint={copy.linkHint} />
        {a.couponCode ? <CopyValue label={copy.coupon} value={a.couponCode} /> : null}
      </div>
      <LinkBuilder origin={origin} code={a.code} />
      <CodeRequestForm request={a.codeRequest} />
      <dl className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {stats.map((s) => (
          <div
            key={s.label}
            className="flex flex-col gap-1 rounded-[var(--radius-card)] bg-surface p-4"
          >
            <dt className="text-small text-muted">{s.label}</dt>
            <dd className="h4 tabular-nums">{s.value}</dd>
            {s.hint ? <dd className="text-small text-muted">{s.hint}</dd> : null}
          </div>
        ))}
      </dl>
      <EarningsTrend points={portal.trend} />
      <CreativesList creatives={portal.creatives} />
      <section className="flex max-w-[48rem] flex-col gap-3">
        <h2 className="h3">{copy.recent}</h2>
        {portal.recent.length === 0 ? (
          <p className="text-body text-muted">{copy.recentEmpty}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {portal.recent.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-4 py-3 text-body">
                <span>{formatInZone(c.placedAt, { dateStyle: 'medium' })}</span>
                <span className="text-muted">{copy.status[c.status] ?? c.status}</span>
                <span className="tabular-nums">{formatPaise(c.commissionPaise)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <PayoutDetailsForm hint={a.payoutHint} />
    </div>
  )
}
