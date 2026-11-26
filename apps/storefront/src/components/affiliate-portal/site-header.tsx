'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Separator } from '@commerce/ui/shadcn/separator'
import { SidebarTrigger } from '@commerce/ui/shadcn/sidebar'
import { usePathname } from 'next/navigation'
import { affiliatePortalContent as copy } from '@/data/affiliate-portal'
import ThemeToggle from './theme-toggle'

type SiteHeaderProps = {
  base: string
  /** The store's contact email, shown as "Support". */
  supportEmail: string | null
}

/** A page's title from its path under the portal's base. */
function titleOf(pathname: string, base: string): string {
  const rest = pathname.slice(base.length) || '/'
  if (rest.startsWith('/commissions')) return copy.nav.commissions
  if (rest.startsWith('/payouts')) return copy.nav.payouts
  if (rest.startsWith('/marketing')) return copy.nav.marketing
  if (rest.startsWith('/settings')) return copy.nav.settings
  if (rest.startsWith('/guide')) return copy.nav.guide
  return copy.nav.dashboard
}

/**
 * shadcn dashboard-01's SiteHeader: the sidebar button, a divider and the page's title, with the
 * store's support email and light or dark at the end.
 */
export default function SiteHeader({ base, supportEmail }: SiteHeaderProps) {
  // Hooks
  const pathname = usePathname()

  // Render logic
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" aria-label={copy.menu} />
        <Separator orientation="vertical" className="mx-2 data-vertical:h-4" />
        <h1 className="text-base font-medium">{titleOf(pathname, base)}</h1>
        <div className="ml-auto flex items-center gap-2">
          {supportEmail ? (
            <Button
              variant="ghost"
              size="sm"
              className="hidden sm:flex"
              nativeButton={false}
              render={<a href={`mailto:${supportEmail}`} title={supportEmail} />}
            >
              {copy.support}
            </Button>
          ) : null}
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}
