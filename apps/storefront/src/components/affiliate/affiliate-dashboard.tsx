import BalancesCard from '@/components/affiliate/balances-card'
import CodeRequestForm from '@/components/affiliate/code-request-form'
import CopyValue from '@/components/affiliate/copy-value'
import CreativesList from '@/components/affiliate/creatives-list'
import EarningsTrend from '@/components/affiliate/earnings-trend'
import LinkBuilder from '@/components/affiliate/link-builder'
import PayoutDetailsForm from '@/components/affiliate/payout-details-form'
import PayoutsList from '@/components/affiliate/payouts-list'
import ProgramTerms from '@/components/affiliate/program-terms'
import RangeStats from '@/components/affiliate/range-stats'
import RecentSales from '@/components/affiliate/recent-sales'
import { affiliateContent } from '@/data/affiliate'
import { ruleAmount } from '@/lib/affiliate-rate'
import type { AffiliatePortal } from '@/lib/affiliates'

type AffiliateDashboardProps = {
  portal: AffiliatePortal & {
    affiliate: NonNullable<AffiliatePortal['affiliate']>
    totals: NonNullable<AffiliatePortal['totals']>
  }
  origin: string
}

const copy = affiliateContent.dashboard

/**
 * An approved affiliate's dashboard, phone first: their link with share buttons and QR, their
 * code, figures for a date range, money and the next payout, recent sales, payouts, payout
 * details, then the trend, creatives, a code request and the program terms.
 */
export default function AffiliateDashboard({ portal, origin }: AffiliateDashboardProps) {
  // Render logic
  const { affiliate: a, totals, program: p } = portal

  return (
    <div className="flex flex-col gap-8 md:gap-10">
      <header className="flex flex-col gap-1">
        <h1 className="h2">{copy.title(a.name)}</h1>
        <p className="text-body text-muted">{copy.rate(ruleAmount(p.rate.rule))}</p>
      </header>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start">
        <LinkBuilder
          origin={origin}
          code={a.code}
          couponCode={a.couponCode}
          couponPercent={p.couponPercent}
        />
        <div className="flex flex-col gap-4 rounded-[var(--radius-card)] bg-surface p-5 sm:p-6">
          {a.couponCode ? (
            <CopyValue
              label={copy.share.code}
              value={a.couponCode}
              hint={copy.share.codeHint(p.couponPercent)}
            />
          ) : null}
          <p className="text-small text-muted">{copy.tips.code}</p>
        </div>
      </div>
      {portal.stats ? <RangeStats range={portal.range} stats={portal.stats} /> : null}
      {portal.outlook ? <BalancesCard totals={totals} outlook={portal.outlook} /> : null}
      <RecentSales sales={portal.recent} />
      <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
        <PayoutsList payouts={portal.payouts} />
        <PayoutDetailsForm hint={a.payoutHint} />
      </div>
      <EarningsTrend points={portal.trend} />
      <CreativesList creatives={portal.creatives} />
      <CodeRequestForm request={a.codeRequest} />
      <ProgramTerms program={p} />
    </div>
  )
}
