import { portalRange } from '@commerce/plugin-affiliates/server'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import AffiliateLinkCard from '@/components/affiliate-portal/affiliate-link-card'
import BalanceTabs from '@/components/affiliate-portal/balance-tabs'
import PerformanceCard from '@/components/affiliate-portal/performance-card'
import ProgramDetails from '@/components/affiliate-portal/program-details'
import RecentCommissions from '@/components/affiliate-portal/recent-commissions'
import SectionCards from '@/components/affiliate-portal/section-cards'
import { affiliatePortalContent } from '@/data/affiliate-portal'
import { portalBase, portalHref, portalStore, portalViewer } from '@/lib/affiliate-portal'
import { loadAffiliatePortal } from '@/lib/affiliates'
import { loadActivity, loadPreviousTotals, totalsOf } from '@/lib/portal-data'
import { outlookLines } from '@/lib/portal-format'

type DashboardPageProps = {
  params: Promise<{ storeId: string }>
  searchParams: Promise<{ range?: string | string[]; program?: string | string[] }>
}

const copy = affiliatePortalContent.dashboard

export const metadata: Metadata = { title: copy.metaTitle }

/**
 * The portal's home, laid out like shadcn's dashboard-01. Signed out: the sign-in page (or the
 * signup page for a `?program=` link). Not an approved affiliate yet: the signup page. Approved:
 * the range's cards with trends, clicks and referrals over time, their link and balance (whose
 * footer asks for payout details while none are saved), and their latest commissions.
 */
export default async function DashboardPage({ params, searchParams }: DashboardPageProps) {
  // Hooks
  const { storeId } = await params
  const query = await searchParams
  const program = typeof query.program === 'string' ? query.program : ''
  const range = portalRange(query.range)
  const [base, viewer] = await Promise.all([portalBase(), portalViewer(storeId)])

  // Early returns
  const programQuery = program ? `?program=${encodeURIComponent(program)}` : ''
  if (!viewer.me) redirect(portalHref(base, program ? `/signup${programQuery}` : '/sign-in'))
  if (viewer.affiliate?.status !== 'approved') redirect(portalHref(base, `/signup${programQuery}`))
  const [portal, store, activity, previous] = await Promise.all([
    loadAffiliatePortal(storeId, viewer.me, undefined, range),
    portalStore(storeId),
    loadActivity(storeId, viewer.affiliate, range),
    loadPreviousTotals(storeId, viewer.affiliate.id, range),
  ])
  const a = portal?.affiliate
  if (!portal || !a || !portal.totals) notFound()

  // Render logic
  const p = portal.program
  return (
    <>
      <SectionCards current={totalsOf(activity.points)} previous={previous} />
      <PerformanceCard range={range} points={activity.points} unit={activity.unit} />
      <div className="grid grid-cols-1 gap-4 px-4 lg:px-6 @5xl/main:grid-cols-2">
        <AffiliateLinkCard
          origin={store.origin}
          code={a.code}
          couponCode={a.couponCode}
          couponPercent={p.couponPercent}
          couponSelected={p.couponSelected}
        />
        <BalanceTabs
          totals={portal.totals}
          outlook={portal.outlook ? outlookLines(portal.outlook) : []}
          program={<ProgramDetails program={p} />}
          payoutHref={a.payoutHint ? null : portalHref(base, '/settings/payout')}
        />
      </div>
      <RecentCommissions rows={portal.recent} href={portalHref(base, '/commissions')} />
    </>
  )
}
