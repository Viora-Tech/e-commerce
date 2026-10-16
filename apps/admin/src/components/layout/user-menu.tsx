'use client'

import { BugIcon, LogOut, Settings, Store } from '@commerce/ui/icons'
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
import { ACCOUNT_MENU, accountContent } from '@/data/account'
import { bugReportContent } from '@/data/bug-report'
import { navigationContent } from '@/data/navigation'
import { useCopy } from '@/hooks/use-copy'
import { authClient } from '@/lib/auth-client'
import { openBugReport } from '@/lib/bug-report-events'
import { routes } from '@/lib/routes'
import MemberAvatar from '../account/member-avatar'
import TopBarTip from './top-bar-tip'

type UserMenuProps = {
  user: { name: string; email: string; image?: string | null }
  /** Adds "Report a bug" (test server only). */
  bugReports: boolean
  /** The button that opens the menu: its look is the caller's. */
  trigger: ReactNode
  triggerClassName: string
  triggerLabel: string
  align?: 'start' | 'end'
  side?: 'top' | 'bottom' | 'right'
  /** `topbar` (Figma "TB · Account menu"): avatar in the header and a "Switch store" row. */
  variant?: 'sidebar' | 'topbar'
  /** The active store's name, for the "Switch store" row (top bar only). */
  storeName?: string | null
  /** Tooltip on the trigger (top bar). */
  tip?: string
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
  variant = 'sidebar',
  storeName = null,
  tip,
}: UserMenuProps) {
  // Hooks
  const copy = useCopy(navigationContent)
  const bugCopy = useCopy(bugReportContent)
  const accountCopy = useCopy(accountContent)
  const router = useRouter()

  // Event handlers
  const handleSignOut = async () => {
    await authClient.signOut()
    router.push(routes.login())
    router.refresh()
  }

  // Render logic
  const topbar = variant === 'topbar'
  const triggerButton = (
    <DropdownMenuTrigger aria-label={triggerLabel} className={triggerClassName}>
      {trigger}
    </DropdownMenuTrigger>
  )

  return (
    <DropdownMenu>
      {tip ? <TopBarTip label={tip}>{triggerButton}</TopBarTip> : triggerButton}
      <DropdownMenuContent align={align} side={side} className={topbar ? 'w-65' : 'w-60'}>
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center gap-2.5 leading-tight">
            {topbar ? (
              <MemberAvatar
                name={user.name}
                email={user.email}
                image={user.image ?? null}
                className="size-8 shrink-0"
                fallbackClassName="bg-primary text-xs text-primary-foreground"
              />
            ) : null}
            <span className="grid min-w-0">
              <span className="truncate font-semibold text-foreground">{user.name}</span>
              <span className="truncate text-xs font-normal text-muted-foreground">
                {user.email}
              </span>
            </span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {/* Your own preferences first, then the store's Settings. */}
          {ACCOUNT_MENU.map((page) => (
            <DropdownMenuItem key={page.href} render={<Link href={page.href} />}>
              <page.icon className="size-4" />
              {accountCopy.pages[page.id]}
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem render={<Link href={routes.settings.home()} />}>
            <Settings className="size-4" />
            {copy.menu.settings}
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {topbar && storeName ? (
          <>
            <DropdownMenuItem render={<Link href={routes.account.stores()} />}>
              <Store className="size-4" />
              <span className="grid min-w-0 leading-tight">
                <span className="truncate">{storeName}</span>
                <span className="truncate text-xs text-muted-foreground">{copy.switchStore}</span>
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : null}
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
