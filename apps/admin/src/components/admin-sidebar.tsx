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
  SidebarHeader,
  useSidebar,
} from '@commerce/ui/shadcn/sidebar'
import { ChevronDown, ExternalLink, LogOut, PanelLeftClose, Store } from 'lucide-react'
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

/* Frame 5:1368: rail 260 wide, white, "3dp Penumbra" shadow. Items sit in a
   14px gutter, each 16/9 padded with an 8px gap; the active one is a solid
   green 6px pill with bold white text. Group labels are 15px at a 24px inset. */
const FOCUS =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar'
const NAV_ITEM = `flex h-8 w-full items-center gap-2 rounded-[0.375rem] px-3 text-nav text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground [&_svg]:size-4 [&_svg]:shrink-0 ${FOCUS}`
const NAV_ITEM_ACTIVE =
  'bg-primary font-semibold text-primary-foreground hover:bg-primary hover:text-primary-foreground'
const NAV_CHILD = `flex h-7 w-full items-center rounded-[0.375rem] pl-9 pr-3 text-nav font-normal text-sidebar-foreground transition-colors hover:text-foreground ${FOCUS}`
const NAV_CHILD_ACTIVE = 'bg-primary-soft font-semibold text-primary hover:text-primary'

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

/** One entry; its Shopify sub-pages unfold beneath it while the section is active. */
function NavSection({ item, pathname }: NavSectionProps) {
  const open = isSectionActive(pathname, item)
  const children = item.children ?? []
  const linkActive = isSectionLinkActive(pathname, item)

  return (
    <li className="flex flex-col gap-1">
      <Link
        href={item.href}
        aria-current={linkActive ? 'page' : undefined}
        className={cn(
          NAV_ITEM,
          linkActive && NAV_ITEM_ACTIVE,
          open && !linkActive && 'font-bold text-foreground',
        )}
      >
        <item.icon strokeWidth={1.8} />
        <span className="min-w-0 flex-1 truncate group-data-[collapsible=icon]:hidden">
          {item.label}
        </span>
      </Link>
      {open && children.length > 0 ? (
        <ul className="flex flex-col gap-0.5 group-data-[collapsible=icon]:hidden">
          {children.map((child) => {
            const active = isChildActive(pathname, child)
            return (
              <li key={child.href}>
                <Link
                  href={child.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(NAV_CHILD, active && NAV_CHILD_ACTIVE)}
                >
                  {child.label}
                </Link>
              </li>
            )
          })}
        </ul>
      ) : null}
    </li>
  )
}

type NavGroupBlockProps = { label?: string | undefined; items: NavItem[]; pathname: string }

/** Label block (24px tall, 24px inset) then the item list in the 14px gutter, 12px below. */
function NavGroupBlock({ label, items, pathname }: NavGroupBlockProps) {
  return (
    <div className="flex flex-col">
      {label ? (
        <p className="px-5 pb-2 text-caption text-muted-foreground-soft group-data-[collapsible=icon]:hidden">
          {label}
        </p>
      ) : null}
      <ul className="flex flex-col gap-1 px-3 group-data-[collapsible=icon]:px-2">
        {items.map((item) => (
          <NavSection key={item.href} item={item} pathname={pathname} />
        ))}
      </ul>
    </div>
  )
}

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
    <Sidebar collapsible="icon" className="border-r-0 shadow-rail">
      {/* 5:1369: 64px tall, 20px padding, wordmark left and collapse glyph right. */}
      <SidebarHeader className="h-14 flex-row items-center justify-between px-4 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2">
        <DropdownMenu>
          <DropdownMenuTrigger className="flex h-6 min-w-0 items-center gap-1.5 text-left">
            <Store className="size-4 shrink-0 text-primary" />
            <span className="truncate text-card-title text-ink-strong group-data-[collapsible=icon]:hidden">
              {active?.name ?? navigationContent.pickStore}
            </span>
            <ChevronDown className="size-4 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden" />
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
          className="hidden size-6 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground group-data-[collapsible=icon]:hidden md:flex"
        >
          <PanelLeftClose className="size-4" strokeWidth={1.6} />
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
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
            {initials(user.name)}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-xs leading-4 group-data-[collapsible=icon]:hidden">
            <span className="truncate font-semibold text-foreground">{user.name}</span>
            <span className="truncate text-muted-foreground">{user.email}</span>
          </div>
          <button
            type="button"
            onClick={signOut}
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
