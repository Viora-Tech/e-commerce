'use client'

import { BugIcon, LogOut, Settings } from '@commerce/ui/icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { ACCOUNT_PAGES } from '@/data/account'
import { bugReportContent } from '@/data/bug-report'
import { navigationContent } from '@/data/navigation'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { authClient } from '@/lib/auth-client'
import { openBugReport } from '@/lib/bug-report-events'
import { pageName } from '@/lib/page-names'
import { routes } from '@/lib/routes'

type UserMenuProps = {
  user: { name: string; email: string }
  /** Adds "Report a bug" (test server only). */
  bugReports: boolean
  /** The button that opens the menu: its look is the caller's. */
  trigger: ReactNode
  triggerClassName: string
  triggerLabel: string
  align?: 'start' | 'end'
  side?: 'top' | 'bottom' | 'right'
}

/**
 * The member's menu, one for the sidebar's user row and the top bar's avatar: account pages
 * first (Account, Appearance; the language choice lives on the Account page), then Settings,
 * and Log out.
 */
export default function UserMenu({
  user,
  bugReports,
  trigger,
  triggerClassName,
  triggerLabel,
  align = 'end',
  side = 'bottom',
}: UserMenuProps) {
  // Hooks
  const copy = useCopy(navigationContent)
  const bugCopy = useCopy(bugReportContent)
  const locale = useLocale()
  const router = useRouter()

  // Event handlers
  const handleSignOut = async () => {
    await authClient.signOut()
    router.push(routes.login())
    router.refresh()
  }

  // Render logic
  return (
    <DropdownMenu>
      <DropdownMenuTrigger aria-label={triggerLabel} className={triggerClassName}>
        {trigger}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} side={side} className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="grid leading-tight">
            <span className="truncate font-semibold">{user.name}</span>
            <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {/* Your own preferences first, then the store's Settings. */}
          {ACCOUNT_PAGES.map((page) => (
            <DropdownMenuItem key={page.href} render={<Link href={page.href} />}>
              <page.icon className="size-4" />
              {pageName(page.href, page.title, locale)}
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem render={<Link href={routes.settings.home()} />}>
            <Settings className="size-4" />
            {copy.menu.settings}
          </DropdownMenuItem>
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
          {copy.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
