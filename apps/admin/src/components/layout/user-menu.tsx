'use client'

import { BugIcon, ClipboardList, LogOut, Settings, Store } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'
import { ACCOUNT_MENU, accountContent } from '@/data/account'
import { bugReportContent } from '@/data/bug-report'
import { navigationContent } from '@/data/navigation'
import { useCopy } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { useUnreadBugReports } from '@/hooks/use-unread-bug-reports'
import { authClient } from '@/lib/auth-client'
import { openBugReport } from '@/lib/bug-report-events'
import { routes } from '@/lib/routes'
import MemberAvatar from '../account/member-avatar'
import TopBarTip from './top-bar-tip'

type UserMenuProps = {
  user: { name: string; email: string; image?: string | null }
  /** Adds "Report a bug" and "My reports", with a dot when a report has news (test server only). */
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
  const { member } = usePermissions()
  const unreadReports = useUnreadBugReports(bugReports)

  // Event handlers
  const handleSignOut = async () => {
    await authClient.signOut()
    router.push(routes.login())
    router.refresh()
  }

  // Render logic
  const topbar = variant === 'topbar'
  /* Figma "TB · Account menu": the store row reads "Waimers · Owner" over "Switch store". */
  const role = member ? (member.isOwner ? copy.storeRole.owner : member.roleName) : null
  /* The go-to keys (G A, G ,) shown beside their rows, as in Figma. */
  const goKeys: Record<string, string> = { account: 'G A' }
  const triggerButton = (
    <DropdownMenuTrigger
      aria-label={
        unreadReports > 0
          ? `${triggerLabel}, ${bugCopy.myReportsUnread(unreadReports)}`
          : triggerLabel
      }
      className={cn(triggerClassName, unreadReports > 0 && 'relative')}
    >
      {trigger}
      {unreadReports > 0 ? (
        <span
          aria-hidden="true"
          className="absolute top-0.5 right-0.5 size-2 rounded-full bg-info ring-2 ring-card"
        />
      ) : null}
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
              {goKeys[page.id] ? (
                <DropdownMenuShortcut>{goKeys[page.id]}</DropdownMenuShortcut>
              ) : null}
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem render={<Link href={routes.settings.home()} />}>
            <Settings className="size-4" />
            {copy.menu.settings}
            <DropdownMenuShortcut>G ,</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {topbar && storeName ? (
          <>
            <DropdownMenuItem render={<Link href={routes.account.stores()} />}>
              <Store className="size-4" />
              <span className="grid min-w-0 leading-tight">
                <span className="truncate">{role ? `${storeName} · ${role}` : storeName}</span>
                <span className="truncate text-xs text-muted-foreground">{copy.switchStore}</span>
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        ) : null}
        {bugReports ? (
          <>
            <DropdownMenuItem onClick={openBugReport}>
              <BugIcon className="size-4" />
              {bugCopy.open}
            </DropdownMenuItem>
            <DropdownMenuItem render={<Link href={routes.account.bugReports()} />}>
              <ClipboardList className="size-4" />
              {bugCopy.myReports}
              {unreadReports > 0 ? (
                <span
                  role="img"
                  aria-label={bugCopy.myReportsUnread(unreadReports)}
                  className="ml-auto size-2 rounded-full bg-info"
                />
              ) : null}
            </DropdownMenuItem>
          </>
        ) : null}
        <DropdownMenuItem onClick={handleSignOut}>
          <LogOut className="size-4" />
          {copy.signOut}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
