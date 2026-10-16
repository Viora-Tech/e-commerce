import { siteConfig } from '@commerce/config/site'
import { type Permission, permissions } from '@commerce/core/permissions'
import type { LucideIcon } from '@commerce/ui/icons'
import {
  BadgePercent,
  BarChart3,
  Blocks,
  Boxes,
  FolderOpen,
  Home,
  Package,
  Settings,
  ShoppingBag,
  Store,
  TrendingUp,
  Users,
} from '@commerce/ui/icons'
import { routes } from '@/lib/routes'

export type NavChild = { href: string; label: string; permission?: Permission }

export type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  /** Hidden when the member does not hold this. The server still guards each page. */
  permission?: Permission
  /** Sub-pages shown beneath the item while its section is active. */
  children?: NavChild[]
  /** Paths under `href` that another section owns (Pages live under Content, URLs unchanged). */
  excludes?: string[]
}
export type NavGroup = { label?: string; items: NavItem[] }

/** Installed apps with their own pages are listed under this group's Apps entry. */
export const APPS_GROUP = 'Apps'

/** Heading of the pinned group holding Settings. */
export const SETTINGS_GROUP = 'Settings'

/**
 * Sidebar sections, in Shopify's order. Route structure mirrors Shopify's
 * admin so merchants coming from it find everything where they expect.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Workspace',
    items: [
      { href: routes.home(), label: 'Home', icon: Home },
      {
        href: routes.orders.list(),
        label: 'Orders',
        icon: ShoppingBag,
        permission: permissions.ORDERS_READ,
        children: [
          { href: routes.orders.list(), label: 'All orders' },
          { href: routes.orders.drafts(), label: 'Drafts', permission: permissions.DRAFTS_READ },
          {
            href: routes.orders.abandonedCheckouts(),
            label: 'Abandoned checkouts',
            permission: permissions.ORDERS_READ,
          },
          {
            href: routes.orders.shipments(),
            label: 'Shipments',
            permission: permissions.ORDERS_READ,
          },
          { href: routes.orders.returns(), label: 'Returns', permission: permissions.ORDERS_READ },
        ],
      },
      {
        href: routes.products.list(),
        label: 'Products',
        icon: Package,
        permission: permissions.PRODUCTS_READ,
        children: [
          { href: routes.products.list(), label: 'All products' },
          { href: routes.products.collections(), label: 'Collections' },
          { href: routes.products.giftCards(), label: 'Gift cards' },
        ],
      },
      {
        href: routes.stock.home(),
        label: 'Stock',
        icon: Boxes,
        permission: permissions.INVENTORY_READ,
        children: [
          { href: routes.stock.inventory(), label: 'Inventory' },
          { href: routes.stock.purchaseOrders(), label: 'Purchase orders' },
          { href: routes.stock.inboundShipments(), label: 'Inbound shipments' },
          { href: routes.stock.suppliers(), label: 'Suppliers' },
          { href: routes.stock.transfers(), label: 'Transfers' },
        ],
      },
      {
        href: routes.customers.list(),
        label: 'Customers',
        icon: Users,
        permission: permissions.CUSTOMERS_READ,
        children: [{ href: routes.customers.segments(), label: 'Segments' }],
      },
      {
        href: routes.content.home(),
        label: 'Content',
        icon: FolderOpen,
        permission: permissions.CONTENT_READ,
        children: [
          { href: routes.onlineStore.pages(), label: 'Pages' },
          { href: routes.content.blogPosts(), label: 'Blog posts' },
          { href: routes.content.files(), label: 'Files' },
          { href: routes.content.menus(), label: 'Menus' },
          { href: routes.content.contentTypes(), label: 'Content types' },
        ],
      },
      {
        href: routes.analytics.home(),
        label: 'Analytics',
        icon: BarChart3,
        permission: permissions.ANALYTICS_READ,
        children: [
          { href: routes.analytics.reports(), label: 'Reports' },
          { href: routes.analytics.live(), label: 'Live view' },
        ],
      },
      {
        href: routes.growth.home(),
        label: 'Growth',
        icon: TrendingUp,
        permission: permissions.MARKETING_READ,
        children: [
          { href: routes.growth.campaigns(), label: 'Campaigns' },
          { href: routes.growth.automations(), label: 'Automations' },
          { href: routes.growth.links(), label: 'Links' },
        ],
      },
      {
        href: routes.discounts.list(),
        label: 'Discounts',
        icon: BadgePercent,
        permission: permissions.DISCOUNTS_READ,
      },
    ],
  },
  {
    label: 'Sales channels',
    items: [
      {
        href: routes.onlineStore.home(),
        label: 'Online store',
        icon: Store,
        permission: permissions.ONLINE_STORE_READ,
        excludes: [routes.onlineStore.pages(), routes.onlineStore.blog()],
        children: [
          { href: routes.onlineStore.themes(), label: 'Themes' },
          { href: routes.onlineStore.preferences(), label: 'Preferences' },
          { href: routes.onlineStore.seo(), label: 'SEO' },
        ],
      },
    ],
  },
  {
    label: APPS_GROUP,
    items: [
      {
        href: routes.apps.list(),
        label: 'Apps',
        icon: Blocks,
        permission: permissions.SETTINGS_READ,
      },
    ],
  },
]

/** Pinned to the bottom of the rail, like Shopify. */
export const SETTINGS_NAV: NavItem = {
  href: routes.settings.home(),
  label: 'Settings',
  icon: Settings,
  permission: permissions.SETTINGS_READ,
}

export const navigationContent = {
  pickStore: 'Pick a store',
  stores: 'Stores',
  allStores: 'All stores',
  storesAvailable: (n: number) => `${n} available`,
  viewStore: 'View store',
  signOut: 'Log out',
  collapse: 'Collapse sidebar',
  expand: 'Expand sidebar',
  togglePanel: 'Show or hide the sidebar',
  settingsGroup: 'Settings',
  expandSection: (label: string) => `Show ${label} pages`,
  collapseSection: (label: string) => `Hide ${label} pages`,
  /** The Orders row's count pill. */
  countHint: (n: number) => `${n} waiting to ship`,
  search: {
    placeholder: 'Search orders, products or customers',
    field: `Search or ask ${siteConfig.brand.name} AI…`,
    /** The top bar hint: this part stays, the examples after it take turns. */
    lead: 'Search or ask AI',
    examples: ['“orders to ship”', '“best sellers this week”', '“low stock”', '“today’s sales”'],
    shortcut: '⌘K',
    askAi: 'Ask AI',
    empty: 'Nothing matches',
    orders: 'Orders',
    products: 'Products',
    orderLabel: (n: number, who: string | null) => `#${n}${who ? `, ${who}` : ''}`,
  },
  storeRole: { owner: 'Owner', member: 'Team member' },
  switchStore: 'Switch store',
  openStoreAddress: (domain: string) => `Open ${domain}`,
  usage: {
    title: 'Orders this month',
    of: (used: string, limit: string) => `${used} of ${limit}`,
    moreRoom: (plan: string) => `More room on ${plan} plan`,
  },
  account: 'Account',
  menu: {
    settings: 'Settings',
    help: 'Help on WhatsApp',
    language: 'Language',
    english: 'English',
    hindi: 'हिंदी',
  },
  toggleTheme: 'Toggle theme',
  openMenu: 'Open menu',
  /** Top-bar tooltips (Figma "TB · Hover states"). */
  tips: {
    search: (shortcut: string) => `Search · ${shortcut}`,
    askAi: (mod: string) => `Ask Koomerce AI · ${mod}J`,
    viewStore: (domain: string) => `Open store · ${domain} ↗`,
    theme: (name: string) => `Theme · ${name}`,
  },
  /** The top bar's theme menu (Figma "TB · Theme menu"). */
  theme: {
    light: 'Light',
    dark: 'Dark',
    system: 'System',
    systemHint: 'Follows your device',
  },
} as const

/** A section is active for its own path and everything nested under it; home only for itself. */
export function isSectionActive(pathname: string, item: NavItem): boolean {
  if (item.href === routes.home()) return pathname === item.href
  if ((item.excludes ?? []).some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return false
  }
  if ((item.children ?? []).some((c) => isChildActive(pathname, c))) return true
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

/** A child is active for its exact path or its own nested pages. */
export function isChildActive(pathname: string, child: NavChild): boolean {
  return pathname === child.href || pathname.startsWith(`${child.href}/`)
}

/**
 * The one child to highlight: the most specific match, so `/stock/purchase-orders`
 * lights "Purchase orders" and not also "All products" (`/products`).
 */
export function activeChildHref(pathname: string, children: readonly NavChild[]): string | null {
  const matches = children.filter((c) => isChildActive(pathname, c))
  if (matches.length === 0) return null
  return matches.reduce((best, c) => (c.href.length > best.href.length ? c : best)).href
}

/**
 * The section link highlights when the section is active but no child is, so
 * `/orders/123` lights "Orders" while `/orders/drafts` lights "Drafts".
 */
export function isSectionLinkActive(pathname: string, item: NavItem): boolean {
  if (!isSectionActive(pathname, item)) return false
  return !(item.children ?? []).some((c) => isChildActive(pathname, c))
}
