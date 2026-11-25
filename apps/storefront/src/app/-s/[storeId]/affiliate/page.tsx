import { store } from '@commerce/db'
import { portalRange } from '@commerce/plugin-affiliates/server'
import { eq } from 'drizzle-orm'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import AffiliateApplyForm from '@/components/affiliate/affiliate-apply-form'
import AffiliateBenefits from '@/components/affiliate/affiliate-benefits'
import AffiliateBrandPanel from '@/components/affiliate/affiliate-brand-panel'
import AffiliateDashboard from '@/components/affiliate/affiliate-dashboard'
import AffiliateSignIn from '@/components/affiliate/affiliate-sign-in'
import AffiliateStatus from '@/components/affiliate/affiliate-status'
import { affiliateContent as copy } from '@/data/affiliate'
import { ruleAmount } from '@/lib/affiliate-rate'
import { loadAffiliatePortal } from '@/lib/affiliates'
import { currentCustomer } from '@/lib/customer-session'
import { requestOrigin } from '@/lib/seo'
import { storeRead } from '@/lib/store-cache'

type AffiliatePageProps = {
  params: Promise<{ storeId: string }>
  searchParams: Promise<{ program?: string | string[]; range?: string | string[] }>
}

export const metadata: Metadata = {
  title: copy.metaTitle,
  robots: { index: false, follow: true },
}

/** The store's name for the signup page's brand panel, cached per store version. */
function storeName(storeId: string) {
  return storeRead(storeId, 'store-name', async (tx) => {
    const [s] = await tx.select({ name: store.name }).from(store).where(eq(store.id, storeId))
    return s?.name ?? ''
  })
}

/**
 * The Affiliates app's storefront page. Before approval it is laid out like the shadcn login
 * block: the form half (Login when signed out, "Join our affiliate program", the Benefits box
 * and the application form, or the sign-in JOIN, or their status while it is reviewed) beside
 * the store's brand panel. The dashboard once approved. Not found when the store does not have
 * the app.
 */
export default async function AffiliatePage({ params, searchParams }: AffiliatePageProps) {
  const { storeId } = await params
  const { program: wanted, range } = await searchParams
  const slug = typeof wanted === 'string' ? wanted : undefined
  const me = await currentCustomer(storeId)
  const [portal, origin, name] = await Promise.all([
    loadAffiliatePortal(storeId, me, slug, portalRange(range)),
    requestOrigin(),
    storeName(storeId),
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

  const signIn = `/account/login?return_to=${encodeURIComponent(here)}`
  // The shadcn login block (login-02): the form half centred both ways at a reading width, the
  // brand half beside it; on a phone the brand is a short band above the form.
  return (
    <section className="grid lg:min-h-[48rem] lg:grid-cols-2">
      <AffiliateBrandPanel storeName={name} rate={ruleAmount(p.rate.rule)} />
      <div className="flex flex-col gap-6 px-4 py-8 sm:px-8 lg:order-first lg:px-12 lg:py-12">
        {me ? null : (
          <div className="flex justify-end">
            <Link href={signIn} className="btn btn--secondary">
              <span className="btn__label">{copy.register.login}</span>
            </Link>
          </div>
        )}
        <div className="flex flex-1 items-center justify-center">
          <div className="flex w-full max-w-[28rem] flex-col gap-6">
            <header className="flex flex-col gap-2 text-center">
              <h1 className="m-0! text-[1.5rem]! leading-tight! font-bold! normal-case! tracking-normal! text-ink sm:text-[1.75rem]!">
                {copy.register.heading}
              </h1>
              {p.pitch ? (
                <p className="m-0! text-body text-muted whitespace-pre-line">{p.pitch}</p>
              ) : null}
            </header>
            <AffiliateBenefits program={p} />
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
      </div>
    </section>
  )
}
