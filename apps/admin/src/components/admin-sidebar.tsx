'use client'

import { ChevronDown, ExternalLink, LogOut, PanelLeftClose, Store } from '@commerce/ui/icons'
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
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from '@commerce/ui/shadcn/sidebar'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { NAV_GROUPS, navigationContent, SETTINGS_NAV } from '@/data/navigation'
import { authClient } from '@/lib/auth-client'
import NavGroupBlock from './nav-group-block'

type StoreOption = { id: string; name: string; slug: string }

type AdminSidebarProps = {
  user: { name: string; email: string }
  stores: StoreOption[]
  activeStoreId: string | null
  storefrontUrl: string
}

function initials(name: string): string {
  return (
    name
      .split(' ')
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'U'
  )
}

export default function AdminSidebar({
  user,
  stores,
  activeStoreId,
  storefrontUrl,
}: AdminSidebarProps) {
  // Hooks
  const pathname = usePathname()
  const router = useRouter()
  const { toggleSidebar } = useSidebar()

  // Event handlers
  const handleSwitchStore = async (id: string) => {
    await authClient.organization.setActive({ organizationId: id })
    router.refresh()
  }

  const handleSignOut = async () => {
    await authClient.signOut()
    router.push('/login')
    router.refresh()
  }

  // Render logic
  const active = stores.find((s) => s.id === activeStoreId) ?? null

  return (
    <Sidebar collapsible="icon" className="border-r-0 shadow-rail">
      {/* 5:1369: 64px tall, 20px padding, wordmark left and collapse glyph right. */}
      <SidebarHeader className="h-14 flex-row items-center justify-between px-4 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex h-8 min-w-0 items-center gap-2 text-left">
            {/* Wordmark: initial on the brand colour until a logo upload exists. */}
            <span
              aria-hidden="true"
              className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-[0.75rem] font-bold text-primary-foreground shadow-lift"
            >
              {(active?.name ?? navigationContent.pickStore).charAt(0).toUpperCase()}
            </span>
            <span className="truncate text-card-title font-bold tracking-tight text-ink-strong group-data-[collapsible=icon]:hidden">
              {active?.name ?? navigationContent.pickStore}
            </span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                {navigationContent.stores}
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            {stores.map((s) => (
              <DropdownMenuItem key={s.id} onSelect={() => handleSwitchStore(s.id)}>
                <Store className="size-4" />
                {s.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem render={<Link href="/select-store" />}>
              {navigationContent.allStores}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={navigationContent.collapse}
          className="hidden size-6 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground group-data-[collapsible=icon]:hidden md:flex"
        >
          <PanelLeftClose className="size-6" strokeWidth={1.6} />
        </button>
      </SidebarHeader>

      {/* Group rhythm from the frame: first label 8px under the header, groups 24px apart. */}
      <SidebarContent className="no-scrollbar gap-5 pt-1">
        {NAV_GROUPS.map((group, gi) => (
          <NavGroupBlock
            key={group.label ?? gi}
            label={group.label}
            items={group.items}
            pathname={pathname}
          />
        ))}
        <NavGroupBlock
          label={navigationContent.adminGroup}
          items={[SETTINGS_NAV]}
          pathname={pathname}
        />
      </SidebarContent>

      {/* 5:1477: user card (20/12 padding, 40px avatar) then the shop card, 12px apart. */}
      <SidebarFooter className="gap-2 p-0 pb-4 pt-6">
        <div className="flex items-center gap-3 px-4 py-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary ring-1 ring-primary/20">
            {initials(user.name)}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-xs leading-4 group-data-[collapsible=icon]:hidden">
            <span className="truncate font-semibold text-foreground">{user.name}</span>
            <span className="truncate text-muted-foreground">{user.email}</span>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            aria-label={navigationContent.signOut}
            title={navigationContent.signOut}
            className="flex size-5 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground group-data-[collapsible=icon]:hidden"
          >
            <LogOut className="size-4" />
          </button>
        </div>
        <a
          href={storefrontUrl}
          target="_blank"
          rel="noreferrer"
          className="mx-2 flex h-9 items-center gap-2 rounded-[0.375rem] bg-card px-4 text-nav text-ink-strong shadow-lift transition-colors hover:bg-sidebar-accent group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <Store className="size-4 text-primary" strokeWidth={1.8} />
          <span className="min-w-0 flex-1 truncate group-data-[collapsible=icon]:hidden">
            {navigationContent.viewStore}
          </span>
          <ExternalLink className="size-4 text-muted-foreground group-data-[collapsible=icon]:hidden" />
        </a>
      </SidebarFooter>
    </Sidebar>
  )
}
