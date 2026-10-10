'use client'

import { cn } from '@commerce/ui/lib/utils'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ACCOUNT_NAV, accountContent } from '@/data/account'
import { useCopy } from '@/hooks/use-copy'

const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'

/* Same rows as the settings rail; on phones they sit side by side as a scrolling tab strip. */
const TAB = `flex h-8 min-w-0 shrink-0 items-center gap-2.5 rounded-[0.5rem] px-3 text-nav text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground md:w-full [&_svg]:size-4 [&_svg]:shrink-0 ${FOCUS}`
const TAB_ACTIVE = 'bg-secondary font-medium text-ink-strong hover:bg-secondary'

/** The account pages' rail: Profile, Stores, Language & region, Appearance; all the member's own. */
export default function AccountNav() {
  // Hooks
  const copy = useCopy(accountContent)
  const pathname = usePathname()

  return (
    <nav
      aria-label={copy.nav.label}
      className="flex w-full flex-col gap-1 md:sticky md:top-6 md:w-56 md:shrink-0 md:self-start"
    >
      <p className="text-eyebrow hidden px-3 md:block">{copy.nav.label}</p>
      <ul className="no-scrollbar -mx-4 flex flex-row gap-1 overflow-x-auto px-4 md:mx-0 md:flex-col md:overflow-visible md:px-0">
        {ACCOUNT_NAV.map((page) => {
          const active = pathname === page.href
          return (
            <li key={page.href}>
              <Link
                href={page.href}
                aria-current={active ? 'page' : undefined}
                className={cn(TAB, active && TAB_ACTIVE)}
              >
                <page.icon aria-hidden="true" />
                <span className="truncate">{copy.pages[page.id]}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
