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
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  APPS_GROUP,
  NAV_GROUPS,
  type NavItem,
  navigationContent,
  SETTINGS_NAV,
} from '@/data/navigation'
import { authClient } from '@/lib/auth-client'
import NavGroupBlock from './nav-group-block'

type StoreOption = { id: string; name: string; slug: string }

type AdminSidebarProps = {
  user: { name: string; email: string }
  stores: StoreOption[]
  activeStoreId: string | null
  storefrontUrl: string
  apps: { id: string; name: string; icon: string | null }[]
  logoUrl: string | null
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

/** Installed apps hang under the Apps entry, like Drafts under Orders. */
function nestApps(items: NavItem[], apps: AdminSidebarProps['apps']): NavItem[] {
  const children = apps.map((a) => ({ href: `/apps/${a.id}`, label: a.name }))
  return items.map((item) =>
    item.href === '/apps' ? { ...item, children: [...(item.children ?? []), ...children] } : item,
  )
}

export default function AdminSidebar({
  user,
  stores,
  activeStoreId,
  storefrontUrl,
  apps,
  logoUrl,
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
    <Sidebar collapsible="icon" className="group-data-[side=left]:border-r-0">
      {/* Store switcher (Saleor mounting point): 56px row, store mark, name and chevron; collapse glyph right. */}
      <SidebarHeader className="h-14 flex-row items-center justify-between px-4 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2">
        <DropdownMenu>
          <DropdownMenuTrigger className="-mx-1.5 flex h-8 min-w-0 items-center gap-2 rounded-md px-1.5 text-left transition-colors hover:bg-sidebar-accent">
            {/* Brand mark: the storefront theme's logo when the store has one, else a
                refined monogram (accent-neutral, not a hardcoded initial style). */}
            {logoUrl ? (
              <span
                aria-hidden="true"
                className="flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-card"
              >
                <Image
                  src={logoUrl}
                  alt=""
                  width={24}
                  height={24}
                  className="size-full object-contain"
                />
              </span>
            ) : (
              <span
                aria-hidden="true"
                className="flex size-6 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-[0.75rem] font-semibold text-muted-foreground"
              >
                {(active?.name ?? navigationContent.pickStore).charAt(0).toUpperCase()}
              </span>
            )}
            <span className="truncate text-body-strong font-semibold text-ink-strong group-data-[collapsible=icon]:hidden">
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

      {/* Group rhythm: first label 8px under the header, groups 20px apart. */}
      <SidebarContent className="no-scrollbar gap-4 pt-2">
        {NAV_GROUPS.map((group, gi) => (
          <NavGroupBlock
            key={group.label ?? gi}
            label={group.label}
            items={group.label === APPS_GROUP ? nestApps(group.items, apps) : group.items}
            pathname={pathname}
          />
        ))}
        <NavGroupBlock
          label={navigationContent.adminGroup}
          items={[SETTINGS_NAV]}
          pathname={pathname}
        />
      </SidebarContent>

      {/* A rule, then the member and the store link. */}
      <SidebarFooter className="gap-3 p-0 pt-4 pb-4">
        <div className="mx-3 border-border border-t" />
        <div className="flex items-center gap-3 px-6 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-foreground ring-1 ring-border">
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
          className="mx-3 flex h-8 items-center gap-2 rounded-md border border-border bg-card px-3 text-nav text-ink-strong transition-colors hover:bg-sidebar-accent group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <Store className="size-4 text-primary" />
          <span className="min-w-0 flex-1 truncate group-data-[collapsible=icon]:hidden">
            {navigationContent.viewStore}
          </span>
          <ExternalLink className="size-4 text-muted-foreground group-data-[collapsible=icon]:hidden" />
        </a>
      </SidebarFooter>
    </Sidebar>
  )
}
