'use client'

import { cn } from '@commerce/ui/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@commerce/ui/shadcn/sidebar'
import { ChevronsUpDown, ExternalLink, LogOut, PanelLeftClose, Store } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  isChildActive,
  isSectionActive,
  isSectionLinkActive,
  NAV_GROUPS,
  type NavItem,
  navigationContent,
  SETTINGS_NAV,
} from '@/data/navigation'
import { authClient } from '@/lib/auth-client'

type StoreOption = { id: string; name: string; slug: string }

type AdminSidebarProps = {
  user: { name: string; email: string }
  stores: StoreOption[]
  activeStoreId: string | null
  storefrontUrl: string
}

const NAV_ITEM =
  'h-10 gap-3 rounded-lg px-3 text-[13px] text-sidebar-foreground [&_svg]:size-5 data-active:bg-primary data-active:font-semibold data-active:text-primary-foreground data-active:hover:bg-primary data-active:hover:text-primary-foreground'

const NAV_CHILD =
  'h-9 rounded-md px-3 text-[13px] text-muted-foreground hover:text-foreground data-active:bg-primary-soft data-active:font-semibold data-active:text-primary'

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

type NavSectionProps = { item: NavItem; pathname: string }

/** One top-level entry; its children unfold beneath it while the section is active. */
function NavSection({ item, pathname }: NavSectionProps) {
  const open = isSectionActive(pathname, item)
  const children = item.children ?? []

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={<Link href={item.href} />}
        isActive={isSectionLinkActive(pathname, item)}
        tooltip={item.label}
        className={cn(
          NAV_ITEM,
          open && !isSectionLinkActive(pathname, item) && 'font-semibold text-foreground',
        )}
      >
        <item.icon strokeWidth={1.8} />
        <span>{item.label}</span>
      </SidebarMenuButton>
      {open && children.length > 0 ? (
        <SidebarMenuSub className="mx-0 mt-0.5 gap-0.5 border-0 pl-11 pr-0">
          {children.map((child) => (
            <SidebarMenuSubItem key={child.href}>
              <SidebarMenuSubButton
                render={<Link href={child.href} />}
                isActive={isChildActive(pathname, child)}
                className={NAV_CHILD}
              >
                <span>{child.label}</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          ))}
        </SidebarMenuSub>
      ) : null}
    </SidebarMenuItem>
  )
}

/** Kit sidebar: white rail, Shopify sections with unfolding sub-pages, green active pill, settings + user pinned bottom. */
export function AdminSidebar({ user, stores, activeStoreId, storefrontUrl }: AdminSidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { toggleSidebar } = useSidebar()
  const active = stores.find((s) => s.id === activeStoreId) ?? null

  async function switchStore(id: string) {
    await authClient.organization.setActive({ organizationId: id })
    router.refresh()
  }

  async function signOut() {
    await authClient.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="h-16 justify-center px-3">
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    className="h-11 data-open:bg-sidebar-accent [&_svg]:size-5"
                  />
                }
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Store className="size-5" />
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-[13px] font-bold text-foreground">
                    {active?.name ?? navigationContent.pickStore}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {active?.slug ?? navigationContent.storesAvailable(stores.length)}
                  </span>
                </div>
                <ChevronsUpDown className="ml-auto size-4 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-60">
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  {navigationContent.stores}
                </DropdownMenuLabel>
                {stores.map((s) => (
                  <DropdownMenuItem key={s.id} onSelect={() => switchStore(s.id)}>
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
              className="hidden size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground group-data-[collapsible=icon]:hidden md:flex"
            >
              <PanelLeftClose className="size-5" />
            </button>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="gap-0 px-3">
        {NAV_GROUPS.map((group, gi) => (
          <SidebarGroup key={group.label ?? gi} className="px-0 py-2">
            {group.label ? (
              <SidebarGroupLabel className="h-7 px-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground-soft">
                {group.label}
              </SidebarGroupLabel>
            ) : null}
            <SidebarGroupContent>
              <SidebarMenu className="gap-0.5">
                {group.items.map((item) => (
                  <NavSection key={item.href} item={item} pathname={pathname} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="gap-3 px-3 pb-4">
        <SidebarMenu>
          <NavSection item={SETTINGS_NAV} pathname={pathname} />
        </SidebarMenu>
        <div className="flex items-center gap-3 rounded-lg px-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary">
            {initials(user.name)}
          </div>
          <div className="grid min-w-0 flex-1 leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate text-[13px] font-bold text-foreground">{user.name}</span>
            <span className="truncate text-xs text-muted-foreground">{user.email}</span>
          </div>
          <button
            type="button"
            onClick={signOut}
            aria-label={navigationContent.signOut}
            title={navigationContent.signOut}
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-foreground group-data-[collapsible=icon]:hidden"
          >
            <LogOut className="size-5" />
          </button>
        </div>
        <a
          href={storefrontUrl}
          target="_blank"
          rel="noreferrer"
          className="flex h-11 items-center gap-2 rounded-lg border border-border bg-card px-4 text-[13px] font-medium text-foreground shadow-card hover:bg-sidebar-accent group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <Store className="size-5 text-primary" />
          <span className="flex-1 group-data-[collapsible=icon]:hidden">
            {navigationContent.viewStore}
          </span>
          <ExternalLink className="size-4 text-muted-foreground group-data-[collapsible=icon]:hidden" />
        </a>
      </SidebarFooter>
    </Sidebar>
  )
}
