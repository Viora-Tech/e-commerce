import type { ReactNode } from 'react'
import AccountNav from '@/components/account/account-nav'
import PageBody from '@/components/layout/page-body'

type AccountLayoutProps = { children: ReactNode }

/** Your own preferences (from the account menu): a short rail beside the page, in the same
 *  narrow column as Settings so inputs do not run the full screen width (#82). */
export default function AccountLayout({ children }: AccountLayoutProps) {
  return (
    <PageBody className="mx-auto max-w-[68rem] md:flex-row md:items-start md:gap-8">
      <AccountNav />
      <div className="flex w-full min-w-0 flex-1 flex-col gap-4">{children}</div>
    </PageBody>
  )
}
