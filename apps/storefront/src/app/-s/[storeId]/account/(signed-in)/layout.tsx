import type { ReactNode } from 'react'
import AccountFrame from '@/components/account/account-frame'
import AccountNav from '@/components/account/account-nav'
import { currentCustomer } from '@/lib/customer-session'
import { renderTemplate } from '@/lib/template-render'

type SignedInLayoutProps = { children: ReactNode; params: Promise<{ storeId: string }> }

/**
 * Chrome for the signed-in pages, drawn through the theme's `account` template: its main section
 * (`MainAccount`) is the account nav beside the page, and a merchant can add sections around it
 * in Customize. With no template saved it is just that main section, the page as before. Each
 * page guards itself with `requireCustomer` (it knows its own path for the return trip); here a
 * missing session just renders the page, which redirects.
 */
export default async function SignedInLayout({ children, params }: SignedInLayoutProps) {
  const { storeId } = await params
  const me = await currentCustomer(storeId)
  return renderTemplate(storeId, 'account', {
    renderers: {
      MainAccount: () => (
        <AccountFrame>
          <div className="account-layout">
            {me ? <AccountNav email={me.email ?? me.phone ?? ''} name={me.name} /> : null}
            <div className="account-layout__main">{children}</div>
          </div>
        </AccountFrame>
      ),
    },
  })
}
