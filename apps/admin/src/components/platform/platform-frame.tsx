'use client'

import { siteConfig } from '@commerce/config/site'
import {
  ArrowLeft,
  BugIcon,
  ClipboardList,
  Home,
  ShieldCheck,
  Store,
  Users,
} from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Toaster } from '@commerce/ui/shadcn/sonner'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { platformContent as copy } from '@/data/platform'
import { routes } from '@/lib/routes'

type PlatformFrameProps = {
  /** The staff member signed in (from the guard). */
  email: string
  children: ReactNode
}

const NAV = [
  { href: routes.platform.overview(), label: copy.nav.overview, icon: Home, exact: true },
  { href: routes.platform.stores(), label: copy.nav.stores, icon: Store, exact: false },
  { href: routes.platform.users(), label: copy.nav.users, icon: Users, exact: false },
  { href: routes.platform.audit(), label: copy.nav.audit, icon: ClipboardList, exact: false },
  { href: routes.platform.reports(), label: copy.nav.reports, icon: BugIcon, exact: false },
] as const

const ROW =
  'flex h-8 min-w-0 shrink-0 items-center gap-2 rounded-md px-2 text-body text-sidebar-foreground transition-[background-color] hover:bg-sidebar-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4 [&_svg]:shrink-0'

function isActive(pathname: string, href: string, exact: boolean): boolean {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * The platform console's shell: a narrow rail with the console's own nav (no store switcher,
 * no store apps) and the content panel. On phones the nav becomes a scrolling row on top.
 */
export default function PlatformFrame({ email, children }: PlatformFrameProps) {
  // Hooks
  const pathname = usePathname()

  // Render logic
  const links = NAV.map((item) => {
    const active = isActive(pathname, item.href, item.exact)
    const Icon = item.icon
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? 'page' : undefined}
        className={cn(ROW, active && 'bg-sidebar-accent font-medium')}
      >
        <Icon />
        <span className="truncate">{item.label}</span>
      </Link>
    )
  })

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-sidebar md:flex-row">
      <aside className="flex shrink-0 flex-col gap-4 px-3 pt-3 md:w-60 md:pb-3">
        <div className="flex items-center gap-2 px-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-action text-action-foreground [&_svg]:size-4">
            <ShieldCheck />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-body-strong text-ink-strong">{copy.brand}</span>
            <span className="truncate text-caption text-muted-foreground">
              {siteConfig.brand.name} · {copy.tagline}
            </span>
          </span>
        </div>
        <nav className="no-scrollbar flex gap-1 overflow-x-auto pb-2 md:flex-col md:overflow-visible md:pb-0">
          {links}
        </nav>
        <div className="mt-auto hidden flex-col gap-2 px-2 md:flex">
          <p className="text-caption text-muted-foreground">{copy.notice}</p>
          <p className="truncate text-caption text-muted-foreground">
            {copy.signedInAs} <span className="text-foreground">{email}</span>
          </p>
          <Link href={routes.home()} className={cn(ROW, 'px-0 text-muted-foreground')}>
            <ArrowLeft />
            {copy.backToAdmin}
          </Link>
        </div>
      </aside>
      <main
        id="main"
        className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-background md:mt-2 md:rounded-tl-lg md:border-panel-border md:border-t md:border-l"
      >
        {children}
      </main>
      <Toaster duration={siteConfig.ui.toastMs.default} />
    </div>
  )
}
