import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import AccountFrame from '@/components/account/account-frame'
import MagicLinkSignIn from '@/components/account/magic-link-sign-in'
import { accountContent } from '@/data/account'
import { currentCustomer } from '@/lib/customer-session'
import { magicLinkLive } from '@/lib/shopper-login'

type MagicLinkPageProps = {
  params: Promise<{ storeId: string }>
  searchParams: Promise<{ token?: string }>
}

export const metadata: Metadata = {
  title: accountContent.login.link.title,
  // A sign-in link must never be indexed or leak through the referrer.
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
}

/**
 * Where a magic link lands. Signing in takes a tap on this page, not the visit itself,
 * so an email scanner that opens links cannot use up the shopper's link.
 */
export default async function MagicLinkPage({ params, searchParams }: MagicLinkPageProps) {
  const { storeId } = await params
  const { token } = await searchParams
  if (await currentCustomer(storeId)) redirect('/account')
  const live = await magicLinkLive(storeId, token)
  return (
    <AccountFrame storeId={storeId}>
      <div className="py-6 md:py-12">
        <MagicLinkSignIn token={live && token ? token : null} />
      </div>
    </AccountFrame>
  )
}
