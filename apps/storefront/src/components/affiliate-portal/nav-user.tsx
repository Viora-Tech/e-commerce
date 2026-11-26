'use client'

import { ChevronsUpDown, CreditCard, ExternalLink, LogOut, UserCircle } from '@commerce/ui/icons'
import { Avatar, AvatarFallback } from '@commerce/ui/shadcn/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@commerce/ui/shadcn/sidebar'
import Link from 'next/link'
import { affiliatePortalContent as copy } from '@/data/affiliate-portal'
import { portalSignOutAction } from '@/lib/portal-actions'

type NavUserProps = {
  affiliate: { name: string; email: string | null; status: string }
  base: string
  storeOrigin: string
}

/** First letters of a name, for the avatar. */
function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || '?'
  )
}

/**
 * shadcn's NavUser: the affiliate's avatar, name and email at the foot of the sidebar, opening
 * their account menu (profile, payout details, the store, log out).
 */
export default function NavUser({ affiliate, base, storeOrigin }: NavUserProps) {
  // Hooks
  const { isMobile } = useSidebar()

  // Event handlers
  const handleSignOut = () => {
    void portalSignOutAction()
  }

  // Render logic
  const who = (
    <>
      <Avatar className="size-8 rounded-lg">
        <AvatarFallback className="rounded-lg">{initials(affiliate.name)}</AvatarFallback>
      </Avatar>
      <div className="grid flex-1 text-left text-sm leading-tight">
        <span className="truncate font-medium">{affiliate.name}</span>
        <span className="truncate text-xs text-muted-foreground">
          {affiliate.email ?? copy.status[affiliate.status]}
        </span>
      </div>
    </>
  )
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground"
              />
            }
          >
            {who}
            <ChevronsUpDown className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56 rounded-lg"
            side={isMobile ? 'bottom' : 'right'}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">{who}</div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem render={<Link href={`${base}/settings/profile`} />}>
                <UserCircle />
                {copy.settings.tabs.profile}
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href={`${base}/settings/payout`} />}>
                <CreditCard />
                {copy.settings.tabs.payout}
              </DropdownMenuItem>
              <DropdownMenuItem render={<a href={storeOrigin} target="_blank" rel="noreferrer" />}>
                <ExternalLink />
                {copy.nav.shop}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut />
              {copy.nav.signOut}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
