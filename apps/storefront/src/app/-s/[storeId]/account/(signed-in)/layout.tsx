import type { ReactNode } from 'react'
import AccountNav from '@/components/account/account-nav'
import { currentCustomer } from '@/lib/customer-session'

type SignedInLayoutProps = { children: ReactNode; params: Promise<{ storeId: string }> }

/**
 * Chrome for the signed-in pages. Each page guards itself with `requireCustomer`
 * (it knows its own path for the return trip); here a missing session just
 * renders the page, which redirects.
 */
export default async function SignedInLayout({ children, params }: SignedInLayoutProps) {
  const { storeId } = await params
  const me = await currentCustomer(storeId)
  return (
    <>
      {me ? <AccountNav email={me.email ?? me.phone ?? ''} name={me.name} /> : null}
      {children}
    </>
  )
}
