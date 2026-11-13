import { settingsSecret } from '@commerce/config'
import { openToken } from '@commerce/core'
import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import AccountFrame from '@/components/account/account-frame'
import SignIn from '@/components/account/sign-in'
import { accountContent } from '@/data/account'
import { currentCustomer, safeReturnTo } from '@/lib/customer-session'
import { type PendingLink, parseLoginError } from '@/lib/login-errors'
import { PENDING_LINK_COOKIE } from '@/lib/shopper-login'
import { storeSignIn } from '@/lib/sign-in-methods'
import { renderTemplate } from '@/lib/template-render'

type LoginPageProps = {
  params: Promise<{ storeId: string }>
  searchParams: Promise<{ return_to?: string; error?: string; confirm?: string }>
}

export const metadata: Metadata = { title: accountContent.login.title }

/** The email a provider sign-in is waiting to confirm, from its signed cookie. */
async function pendingEmail(confirm: string | undefined): Promise<string | null> {
  if (confirm !== '1') return null
  const raw = (await cookies()).get(PENDING_LINK_COOKIE)?.value
  const opened = openToken<PendingLink>(raw, settingsSecret(), 'pending-link')
  return opened.ok ? opened.payload.m : null
}

export default async function LoginPage({ params, searchParams }: LoginPageProps) {
  const { storeId } = await params
  const query = await searchParams
  const returnTo = safeReturnTo(query.return_to)
  if (await currentCustomer(storeId)) redirect(returnTo)
  const [signIn, confirmEmail] = await Promise.all([
    storeSignIn(storeId),
    pendingEmail(query.confirm),
  ])
  // The theme's `login` template: its main section is the sign-in form, as before.
  return renderTemplate(storeId, 'login', {
    renderers: {
      MainLogin: () => (
        <AccountFrame storeId={storeId}>
          <div className="md:py-6">
            <SignIn
              returnTo={returnTo}
              methods={signIn.methods}
              checkout={signIn.checkout}
              options={signIn.options}
              oneTapClientId={signIn.oneTapClientId}
              error={parseLoginError(query.error)}
              confirmEmail={confirmEmail}
            />
          </div>
        </AccountFrame>
      ),
    },
  })
}
