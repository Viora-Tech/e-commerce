import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { FieldSeparator } from '@commerce/ui/shadcn/field'
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import AuthFrame from '@/components/affiliate-portal/auth-frame'
import EmailSignIn from '@/components/affiliate-portal/email-sign-in'
import { affiliatePortalContent } from '@/data/affiliate-portal'
import { portalBase, portalHref, portalStore, portalViewer } from '@/lib/affiliate-portal'
import { PORTAL_CONTINUE_PATH, PORTAL_PATH } from '@/lib/portal-routing'

type SignInPageProps = { params: Promise<{ storeId: string }> }

const copy = affiliatePortalContent.signIn

export const metadata: Metadata = { title: copy.metaTitle }

/**
 * The portal's sign-in, laid out like shadcn's login-03. "Sign in with your store account"
 * covers every way the store offers (Google, phone, passkey): on a store domain it is the
 * store's own sign-in page; on the portal's own host it goes through the store's domain, where
 * that session lives, and comes back signed in (`/affiliate/continue`, then `/auth`). Below it,
 * an email code signs in right here.
 */
export default async function SignInPage({ params }: SignInPageProps) {
  // Hooks
  const { storeId } = await params
  const [base, viewer, store] = await Promise.all([
    portalBase(),
    portalViewer(storeId),
    portalStore(storeId),
  ])

  // Early returns
  if (viewer.me)
    redirect(portalHref(base, viewer.affiliate?.status === 'approved' ? '/' : '/signup'))

  // Render logic
  const storeAccount =
    base === ''
      ? `${store.origin}${PORTAL_CONTINUE_PATH}`
      : `/account/login?return_to=${encodeURIComponent(PORTAL_PATH)}`
  return (
    <AuthFrame store={store}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-xl">{copy.title}</CardTitle>
          <CardDescription>{copy.body}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <Button
            variant="outline"
            className="w-full"
            nativeButton={false}
            render={<a href={storeAccount} />}
          >
            {copy.store}
          </Button>
          <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
            {copy.orEmail}
          </FieldSeparator>
          <EmailSignIn returnTo={portalHref(base, '/')} />
          <p className="text-center text-sm">
            {copy.noAccount}{' '}
            <Link href={portalHref(base, '/signup')} className="underline underline-offset-4">
              {copy.join}
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthFrame>
  )
}
