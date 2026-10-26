import { portalRange } from '@commerce/plugin-affiliates/server'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import AffiliateApplyForm from '@/components/affiliate/affiliate-apply-form'
import AffiliateDashboard from '@/components/affiliate/affiliate-dashboard'
import AffiliateLanding from '@/components/affiliate/affiliate-landing'
import AffiliateSignIn from '@/components/affiliate/affiliate-sign-in'
import AffiliateStatus from '@/components/affiliate/affiliate-status'
import ProgramTerms from '@/components/affiliate/program-terms'
import { affiliateContent as copy } from '@/data/affiliate'
import { loadAffiliatePortal } from '@/lib/affiliates'
import { currentCustomer } from '@/lib/customer-session'
import { requestOrigin } from '@/lib/seo'

type AffiliatePageProps = {
  params: Promise<{ storeId: string }>
  searchParams: Promise<{ program?: string | string[]; range?: string | string[] }>
}

export const metadata: Metadata = {
  title: copy.metaTitle,
  robots: { index: false, follow: true },
}

/**
 * The Affiliates app's storefront page: the program's pitch and terms with an application form
 * for a signed-in shopper, their status while it is reviewed, and the dashboard once approved.
 * Not found when the store does not have the app.
 */
export default async function AffiliatePage({ params, searchParams }: AffiliatePageProps) {
  const { storeId } = await params
  const { program: wanted, range } = await searchParams
  const slug = typeof wanted === 'string' ? wanted : undefined
  const me = await currentCustomer(storeId)
  const [portal, origin] = await Promise.all([
    loadAffiliatePortal(storeId, me, slug, portalRange(range)),
    requestOrigin(),
  ])

  // Early returns
  if (!portal) notFound()
  const a = portal.affiliate
  if (a?.status === 'approved' && portal.totals)
    return (
      <section className="page-width py-8 md:py-14">
        <AffiliateDashboard
          portal={{ ...portal, affiliate: a, totals: portal.totals }}
          origin={origin}
        />
      </section>
    )

  // Render logic
  const p = portal.program
  const here = p.isDefault ? '/affiliate' : `/affiliate?program=${p.slug}`

  return (
    <section className="page-width py-8 md:py-14">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] lg:items-start lg:gap-12">
        <div className="flex flex-col gap-8">
          <AffiliateLanding program={p} />
          <ProgramTerms program={p} />
        </div>
        <div className="lg:sticky lg:top-24">
          {a ? (
            <AffiliateStatus affiliate={a} />
          ) : !p.active ? (
            <p className="rounded-[var(--radius-card)] bg-surface p-6 text-body text-muted">
              {copy.closed}
            </p>
          ) : me ? (
            <AffiliateApplyForm
              defaultName={me.name ?? ''}
              email={me.email ?? null}
              terms={p.terms}
              program={p.isDefault ? undefined : p.slug}
              fields={p.form}
            />
          ) : (
            <AffiliateSignIn returnTo={here} />
          )}
        </div>
      </div>
    </section>
  )
}
