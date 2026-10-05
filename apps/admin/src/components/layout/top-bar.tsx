'use client'

import { Bell, BugIcon, ExternalLink, LogOut, Moon, Search, Sun } from '@commerce/ui/icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import { Kbd } from '@commerce/ui/shadcn/kbd'
import { Popover, PopoverContent, PopoverTrigger } from '@commerce/ui/shadcn/popover'
import { SidebarTrigger } from '@commerce/ui/shadcn/sidebar'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useSyncExternalStore } from 'react'
import { ACCOUNT_PAGES } from '@/data/account'
import { bugReportContent } from '@/data/bug-report'
import { commandContent } from '@/data/command-palette'
import { navigationContent } from '@/data/navigation'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { authClient } from '@/lib/auth-client'
import { openBugReport } from '@/lib/bug-report-events'
import { initials } from '@/lib/initials'
import { pageName } from '@/lib/page-names'
import { openPalette } from '@/lib/palette-events'

type TopBarProps = {
  user: { name: string; email: string }
  /** Opens the live storefront in a new tab. */
  storefrontUrl: string
  /** Adds "Report a bug" to the account menu (test server only). */
  bugReports: boolean
}

/* Nothing to subscribe to: the snapshot only differs between the server and the browser. */
const noSubscription = () => () => {}

/**
 * A slim, quiet header at the top of the white content panel (Saleor keeps chrome light):
 * the search field on the left (opens the command palette, as does ⌘K); notifications,
 * the light/dark switch and the account menu on the right. On phones it also opens the rail.
 */
export default function TopBar({ user, storefrontUrl, bugReports }: TopBarProps) {
  // Hooks
  const navCopy = useCopy(navigationContent)
  const bugCopy = useCopy(bugReportContent)
  const locale = useLocale()
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  /* The theme lives in localStorage, so the server cannot know it. False while
     hydrating (matching the server HTML), true straight after, without an effect. */
  const hydrated = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  )

  // Event handlers
  const handleSignOut = async () => {
    await authClient.signOut()
    router.push('/login')
    router.refresh()
  }

  // Render logic
  const dark = hydrated && resolvedTheme === 'dark'

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 bg-sidebar px-4 md:pr-6 md:pl-0">
      <SidebarTrigger className="-ml-1 md:hidden" aria-label={navCopy.openMenu} />
      {/* The one search: a quiet field that opens the palette (records, actions, pages); ⌘K too. */}
      <div className="flex min-w-0 flex-1">
        <button
          type="button"
          onClick={openPalette}
          aria-label={commandContent.field}
          className="flex h-9 w-full max-w-md min-w-0 items-center gap-2 rounded-xl border border-border bg-card px-3.5 text-left shadow-xs transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Search className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.6} />
          <span className="min-w-0 flex-1 truncate text-body text-muted-foreground">
            {commandContent.field}
          </span>
          <Kbd className="hidden sm:inline-flex">{navCopy.search.shortcut}</Kbd>
        </button>
      </div>

      <a
        href={storefrontUrl}
        target="_blank"
        rel="noreferrer"
        className="hidden h-9 items-center gap-1.5 rounded-xl border border-border bg-card px-3.5 text-body font-medium text-ink-strong shadow-xs transition-colors hover:border-border-strong md:inline-flex"
      >
        {navCopy.viewStore}
        <ExternalLink className="size-3.5 text-muted-foreground" />
      </a>
      <div className="flex h-9 items-center gap-1 rounded-xl border border-border bg-card py-1 pr-1 pl-1 shadow-xs">
        <Popover>
          <PopoverTrigger
            aria-label={navCopy.notifications.label}
            className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150 ease-out hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96]"
          >
            <Bell className="size-[1.125rem]" strokeWidth={1.6} />
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72">
            <p className="text-body-strong">{navCopy.notifications.label}</p>
            <p className="mt-1 text-body text-muted-foreground">{navCopy.notifications.empty}</p>
          </PopoverContent>
        </Popover>

        <button
          type="button"
          role="switch"
          aria-checked={dark}
          aria-label={navCopy.toggleTheme}
          onClick={() => setTheme(dark ? 'light' : 'dark')}
          className="flex h-6 w-11 shrink-0 items-center rounded-full bg-secondary p-0.5 ring-1 ring-border ring-inset transition-colors duration-200 ease-out hover:ring-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:bg-input"
        >
          {/* Knob and icon follow the `dark` class next-themes sets before paint, so
              the markup is the same on the server and the client and never flashes. */}
          <span className="flex size-5 items-center justify-center rounded-full bg-card text-ink-strong shadow-toggle transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none dark:translate-x-5 dark:bg-ink-strong dark:text-background">
            <Sun className="size-3 dark:hidden" />
            <Moon className="hidden size-3 dark:block" />
          </span>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={navCopy.account}
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[0.625rem] font-semibold tracking-tight text-primary ring-1 ring-primary/25 transition-shadow duration-150 ease-out hover:ring-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {initials(user.name, user.email)}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="grid leading-tight">
                <span className="truncate font-semibold">{user.name}</span>
                <span className="truncate text-xs font-normal text-muted-foreground">
                  {user.email}
                </span>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            {/* Your own preferences live here, not in store Settings. */}
            <DropdownMenuGroup>
              {ACCOUNT_PAGES.map((page) => (
                <DropdownMenuItem key={page.href} render={<Link href={page.href} />}>
                  <page.icon className="size-4" />
                  {pageName(page.href, page.title, locale)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            {bugReports ? (
              <DropdownMenuItem onClick={openBugReport}>
                <BugIcon className="size-4" />
                {bugCopy.open}
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="size-4" />
              {navCopy.signOut}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
