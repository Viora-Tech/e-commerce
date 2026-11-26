'use client'

import { CreditCard, FileText, Home, Megaphone, Settings, TrendingUp } from '@commerce/ui/icons'
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
  SidebarRail,
  useSidebar,
} from '@commerce/ui/shadcn/sidebar'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { affiliatePortalContent as copy } from '@/data/affiliate-portal'
import NavUser from './nav-user'
import StoreMark from './store-mark'

type PortalSidebarProps = {
  store: { name: string; iconUrl: string | null }
  affiliate: { name: string; email: string | null; status: string }
  base: string
  storeOrigin: string
}

type NavItem = { path: string; label: string; icon: typeof Home }

const PAGES: NavItem[] = [
  { path: '/', label: copy.nav.dashboard, icon: Home },
  { path: '/commissions', label: copy.nav.commissions, icon: TrendingUp },
  { path: '/payouts', label: copy.nav.payouts, icon: CreditCard },
  { path: '/marketing', label: copy.nav.marketing, icon: Megaphone },
]

const ACCOUNT: NavItem[] = [
  { path: '/settings', label: copy.nav.settings, icon: Settings },
  { path: '/guide', label: copy.nav.guide, icon: FileText },
]

/** `/affiliate` + `/payouts`; the dashboard is the base itself. */
const hrefOf = (base: string, path: string) => (path === '/' ? base || '/' : `${base}${path}`)

/**
 * The portal's sidebar, after shadcn's sidebar-07: the store at the top, the pages, and the
 * affiliate (NavUser) at the bottom with their account menu. Collapses to icons on a desktop and
 * opens as a sheet on a phone.
 */
export default function PortalSidebar({ store, affiliate, base, storeOrigin }: PortalSidebarProps) {
  // Hooks
  const pathname = usePathname()
  const { setOpenMobile } = useSidebar()

  // Helpers
  const isActive = (path: string) => {
    const href = hrefOf(base, path)
    if (path === '/') return pathname === href || pathname === `${href}/`
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  // Event handlers
  const handleNavigate = () => setOpenMobile(false)

  // Render logic
  const menu = (items: NavItem[]) =>
    items.map((item) => (
      <SidebarMenuItem key={item.path}>
        <SidebarMenuButton
          isActive={isActive(item.path)}
          tooltip={item.label}
          render={<Link href={hrefOf(base, item.path)} onClick={handleNavigate} />}
        >
          <item.icon />
          <span>{item.label}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    ))
  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href={hrefOf(base, '/')} onClick={handleNavigate} />}
            >
              <StoreMark name={store.name} iconUrl={store.iconUrl} />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{store.name}</span>
                <span className="truncate text-xs text-muted-foreground">{copy.brand}</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">{menu(PAGES)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>{copy.nav.account}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">{menu(ACCOUNT)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser affiliate={affiliate} base={base} storeOrigin={storeOrigin} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
