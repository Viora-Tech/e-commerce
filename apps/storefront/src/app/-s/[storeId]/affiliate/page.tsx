import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import AffiliateApplyForm from '@/components/affiliate/affiliate-apply-form'
import AffiliateDashboard from '@/components/affiliate/affiliate-dashboard'
import { affiliateContent as copy } from '@/data/affiliate'
import { loadAffiliatePortal } from '@/lib/affiliates'
import { currentCustomer } from '@/lib/customer-session'
import { requestOrigin } from '@/lib/seo'

type AffiliatePageProps = { params: Promise<{ storeId: string }> }

export const metadata: Metadata = {
  title: copy.metaTitle,
  robots: { index: false, follow: true },
}

/**
 * The Affiliates app's storefront page: the program and an application form for a signed-in
 * shopper, their status while it is reviewed, and the dashboard once approved. Not found when
 * the store does not have the app.
 */
export default async function AffiliatePage({ params }: AffiliatePageProps) {
  const { storeId } = await params
  const me = await currentCustomer(storeId)
  const [portal, origin] = await Promise.all([loadAffiliatePortal(storeId, me), requestOrigin()])

  // Early returns
  if (!portal) notFound()
  const a = portal.affiliate
  if (a?.status === 'approved' && portal.totals)
    return (
      <section className="page-width py-10 md:py-14">
        <AffiliateDashboard
          portal={{ ...portal, affiliate: a, totals: portal.totals }}
          origin={origin}
        />
      </section>
    )

  // Render logic
  const p = portal.program
  const status = a ? copy[a.status as 'pending' | 'rejected' | 'suspended'] : null
  return (
    <section className="page-width flex flex-col gap-8 py-10 md:py-14">
      <header className="flex max-w-[40rem] flex-col gap-3">
        <h1 className="h2">{copy.title}</h1>
        <p className="text-body">{p.pitch || copy.intro}</p>
      </header>
      <div className="flex max-w-[40rem] flex-col gap-2">
        <h2 className="h4">{copy.how.title}</h2>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-body">
          <li>{copy.how.link}</li>
          <li>{copy.how.earn(p.holdDays)}</li>
          <li>{copy.how.cookie(p.cookieDays)}</li>
          {p.couponPercent ? <li>{copy.how.coupon(p.couponPercent)}</li> : null}
        </ul>
      </div>
      {status ? (
        <div className="flex max-w-[36rem] flex-col gap-2 rounded-[var(--radius-card)] bg-surface p-6">
          <h2 className="h3">{status.title}</h2>
          <p className="text-body text-muted">{status.body}</p>
        </div>
      ) : !p.active ? (
        <p className="text-body text-muted">{copy.closed}</p>
      ) : me ? (
        <AffiliateApplyForm defaultName={me.name ?? ''} terms={p.terms} />
      ) : (
        <div className="flex max-w-[36rem] flex-col items-start gap-4 rounded-[var(--radius-card)] bg-surface p-6">
          <p className="text-body">{copy.signIn.body}</p>
          <Link className="btn btn--primary" href="/account/login?return_to=%2Faffiliate">
            <span className="btn__label">{copy.signIn.button}</span>
          </Link>
        </div>
      )}
    </section>
  )
}
