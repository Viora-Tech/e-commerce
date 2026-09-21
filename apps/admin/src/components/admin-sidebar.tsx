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
  useSidebar,
} from '@commerce/ui/shadcn/sidebar'
import { ChevronsUpDown, ExternalLink, LogOut, PanelLeftClose, Store } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { isNavActive, NAV_GROUPS, navigationContent } from '@/data/navigation'
import { authClient } from '@/lib/auth-client'

type StoreOption = { id: string; name: string; slug: string }

type AdminSidebarProps = {
  user: { name: string; email: string }
  stores: StoreOption[]
  activeStoreId: string | null
  storefrontUrl: string
}

const NAV_ITEM =
  'h-10 gap-2 rounded-md px-4 text-[15px] text-sidebar-foreground [&_svg]:size-5 data-active:bg-primary data-active:font-bold data-active:text-primary-foreground data-active:hover:bg-primary data-active:hover:text-primary-foreground'

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

/** Kit sidebar: white rail, grouped sections, solid green active pill, user card at the bottom. */
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
                  <span className="truncate text-[15px] font-bold text-foreground">
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

      <SidebarContent className="gap-1 px-1.5">
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label} className="py-1">
            <SidebarGroupLabel className="h-6 px-4 text-[13px] font-medium text-muted-foreground-soft">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {group.items.map((item) => (
                  <SidebarMenuItem key={`${group.label}-${item.label}`}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={isNavActive(pathname, item)}
                      tooltip={item.label}
                      className={cn(NAV_ITEM, item.soon && 'opacity-70')}
                    >
                      <item.icon strokeWidth={1.8} />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="gap-2 px-3 pb-4">
        <div className="flex items-center gap-3 rounded-lg px-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary">
            {initials(user.name)}
          </div>
          <div className="grid min-w-0 flex-1 leading-tight group-data-[collapsible=icon]:hidden">
            <span className="truncate text-[15px] font-bold text-foreground">{user.name}</span>
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
          className="flex h-11 items-center gap-2 rounded-lg border border-border bg-card px-4 text-[15px] font-medium text-foreground shadow-card hover:bg-sidebar-accent group-data-[collapsible=icon]:h-10 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
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
