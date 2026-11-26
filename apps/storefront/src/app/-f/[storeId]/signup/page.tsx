import { Button } from '@commerce/ui/shadcn/button'
import { FieldSeparator } from '@commerce/ui/shadcn/field'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import ApplicationStatus from '@/components/affiliate-portal/application-status'
import BenefitsCard from '@/components/affiliate-portal/benefits-card'
import EmailSignIn from '@/components/affiliate-portal/email-sign-in'
import SignupForm from '@/components/affiliate-portal/signup-form'
import StoreMark from '@/components/affiliate-portal/store-mark'
import { affiliatePortalContent } from '@/data/affiliate-portal'
import { portalBase, portalHref, portalStore, portalViewer } from '@/lib/affiliate-portal'
import { loadAffiliatePortal } from '@/lib/affiliates'
import { portalSignOutAction } from '@/lib/portal-actions'
import { PORTAL_CONTINUE_PATH, PORTAL_PATH } from '@/lib/portal-routing'

type SignupPageProps = {
  params: Promise<{ storeId: string }>
  searchParams: Promise<{ program?: string | string[] }>
}

const copy = affiliatePortalContent.signup

export const metadata: Metadata = { title: copy.metaTitle }

/**
 * Join the program, laid out like shadcn's login-02: the form half (the store's mark, the
 * heading, then sign in first, the application with the program's own questions and terms, or
 * where their application stands) beside a muted half with the program's Benefits. An approved
 * affiliate goes to the dashboard.
 */
export default async function SignupPage({ params, searchParams }: SignupPageProps) {
  // Hooks
  const { storeId } = await params
  const { program: wanted } = await searchParams
  const slug = typeof wanted === 'string' ? wanted : undefined
  const [base, viewer, store] = await Promise.all([
    portalBase(),
    portalViewer(storeId),
    portalStore(storeId),
  ])
  const portal = await loadAffiliatePortal(storeId, viewer.me, slug)

  // Early returns
  if (!portal) notFound()
  const a = portal.affiliate
  if (a?.status === 'approved') redirect(portalHref(base, '/'))

  // Render logic
  const p = portal.program
  const here = portalHref(base, `/signup${slug ? `?program=${encodeURIComponent(slug)}` : ''}`)
  const storeAccount =
    base === ''
      ? `${store.origin}${PORTAL_CONTINUE_PATH}`
      : `/account/login?return_to=${encodeURIComponent(`${PORTAL_PATH}/signup`)}`
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <a href={store.origin} className="flex items-center gap-2 font-medium">
            <StoreMark name={store.name} iconUrl={store.iconUrl} size="sm" />
            {store.name}
          </a>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="flex w-full max-w-md flex-col gap-6 py-6">
            <div className="flex flex-col items-center gap-1 text-center">
              <h1 className="text-2xl font-bold">{copy.title}</h1>
              <p className="text-sm text-balance text-muted-foreground">
                {viewer.me ? copy.signedIn : copy.signedOut}
              </p>
            </div>
            <div className="lg:hidden">
              <BenefitsCard program={p} />
            </div>
            {a ? (
              <ApplicationStatus affiliate={a} />
            ) : !p.active ? (
              <p className="text-center text-sm text-muted-foreground">{copy.closed}</p>
            ) : viewer.me ? (
              <SignupForm
                defaultName={viewer.me.name ?? ''}
                email={viewer.me.email ?? null}
                terms={p.terms}
                program={p.isDefault ? undefined : p.slug}
                fields={p.form}
              />
            ) : (
              <div className="flex flex-col gap-6">
                <Button
                  variant="outline"
                  className="w-full"
                  nativeButton={false}
                  render={<a href={storeAccount} />}
                >
                  {affiliatePortalContent.signIn.store}
                </Button>
                <FieldSeparator>{affiliatePortalContent.signIn.orEmail}</FieldSeparator>
                <EmailSignIn returnTo={here} />
              </div>
            )}
            {viewer.me ? (
              <form action={portalSignOutAction} className="text-center text-sm">
                <button type="submit" className="underline underline-offset-4">
                  {copy.signOut}
                </button>
              </form>
            ) : (
              <p className="text-center text-sm">
                {copy.haveAccount}{' '}
                <Link href={portalHref(base, '/sign-in')} className="underline underline-offset-4">
                  {copy.signIn}
                </Link>
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="hidden bg-muted lg:flex lg:items-center lg:justify-center lg:p-10">
        <div className="w-full max-w-sm">
          <BenefitsCard program={p} />
        </div>
      </div>
    </div>
  )
}
