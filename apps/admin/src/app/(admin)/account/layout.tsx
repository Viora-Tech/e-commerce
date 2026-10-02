import type { ReactNode } from 'react'
import AccountNav from '@/components/account/account-nav'
import PageBody from '@/components/layout/page-body'

type AccountLayoutProps = { children: ReactNode }

/** Your own preferences (from the account menu): a short rail beside the page, like Settings. */
export default function AccountLayout({ children }: AccountLayoutProps) {
  return (
    <PageBody className="md:flex-row md:items-start md:gap-6">
      <AccountNav />
      <div className="mx-auto flex w-full min-w-0 max-w-4xl flex-1 flex-col gap-4">{children}</div>
    </PageBody>
  )
}
