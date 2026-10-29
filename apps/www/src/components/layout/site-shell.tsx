import type { ReactNode } from 'react'
import SiteFooter from './site-footer'
import SiteNav from './site-nav'

type SiteShellProps = { children: ReactNode }

/** Nav + page + footer. The cookie-consent provider lives in the root layout. */
export default function SiteShell({ children }: SiteShellProps) {
  return (
    <>
      <SiteNav />
      <main id="main">{children}</main>
      <SiteFooter />
    </>
  )
}
