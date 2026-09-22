import { type Permission, permissions } from '@commerce/core/permissions'
import type { LucideIcon } from '@commerce/ui/icons'
import {
  BadgePercent,
  BarChart3,
  Blocks,
  FolderOpen,
  Home,
  Megaphone,
  Package,
  Settings,
  ShoppingBag,
  Store,
  Users,
} from '@commerce/ui/icons'

export type NavChild = { href: string; label: string; permission?: Permission }

export type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  /** Hidden when the member does not hold this. The server still guards each page. */
  permission?: Permission
  /** Sub-pages shown beneath the item while its section is active. */
  children?: NavChild[]
}
export type NavGroup = { label?: string; items: NavItem[] }

/** Installed apps with their own pages are listed under this group's Apps entry. */
export const APPS_GROUP = 'Apps'

/**
 * Sidebar sections, in Shopify's order. Route structure mirrors Shopify's
 * admin so merchants coming from it find everything where they expect.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Main menu',
    items: [
      { href: '/', label: 'Home', icon: Home },
      {
        href: '/orders',
        label: 'Orders',
        icon: ShoppingBag,
        permission: permissions.ORDERS_READ,
        children: [
          { href: '/orders/drafts', label: 'Drafts', permission: permissions.DRAFTS_READ },
          {
            href: '/orders/abandoned-checkouts',
            label: 'Abandoned checkouts',
            permission: permissions.ORDERS_READ,
          },
        ],
      },
      {
        href: '/products',
        label: 'Products',
        icon: Package,
        permission: permissions.PRODUCTS_READ,
        children: [
          { href: '/products/collections', label: 'Collections' },
          {
            href: '/products/inventory',
            label: 'Inventory',
            permission: permissions.INVENTORY_READ,
          },
          {
            href: '/products/purchase-orders',
            label: 'Purchase orders',
            permission: permissions.INVENTORY_READ,
          },
          {
            href: '/products/transfers',
            label: 'Transfers',
            permission: permissions.INVENTORY_READ,
          },
          { href: '/products/gift-cards', label: 'Gift cards' },
        ],
      },
      {
        href: '/customers',
        label: 'Customers',
        icon: Users,
        permission: permissions.CUSTOMERS_READ,
        children: [{ href: '/customers/segments', label: 'Segments' }],
      },
      {
        href: '/content',
        label: 'Content',
        icon: FolderOpen,
        permission: permissions.CONTENT_READ,
        children: [
          { href: '/content/files', label: 'Files' },
          { href: '/content/metaobjects', label: 'Metaobjects' },
          { href: '/content/menus', label: 'Menus' },
          { href: '/content/blog-posts', label: 'Blog posts' },
        ],
      },
      {
        href: '/analytics',
        label: 'Analytics',
        icon: BarChart3,
        permission: permissions.ANALYTICS_READ,
        children: [
          { href: '/analytics/reports', label: 'Reports' },
          { href: '/analytics/live', label: 'Live view' },
        ],
      },
      {
        href: '/marketing',
        label: 'Marketing',
        icon: Megaphone,
        children: [
          { href: '/marketing/campaigns', label: 'Campaigns' },
          { href: '/marketing/automations', label: 'Automations' },
        ],
      },
      {
        href: '/discounts',
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
        href: '/online-store',
        label: 'Online Store',
        icon: Store,
        permission: permissions.ONLINE_STORE_READ,
        children: [
          { href: '/online-store/themes', label: 'Themes' },
          { href: '/online-store/pages', label: 'Pages' },
          { href: '/online-store/preferences', label: 'Preferences' },
        ],
      },
    ],
  },
  {
    label: APPS_GROUP,
    items: [{ href: '/apps', label: 'Apps', icon: Blocks, permission: permissions.SETTINGS_READ }],
  },
]

/** Pinned to the bottom of the rail, like Shopify. */
export const SETTINGS_NAV: NavItem = {
  href: '/settings',
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
  signOut: 'Sign out',
  collapse: 'Collapse sidebar',
  adminGroup: 'Admin',
  expandSection: (label: string) => `Show ${label} pages`,
  collapseSection: (label: string) => `Hide ${label} pages`,
  expandGroup: (label: string) => `Show ${label}`,
  collapseGroup: (label: string) => `Hide ${label}`,
  search: {
    placeholder: 'Search orders, products or customers',
    shortcut: '⌘K',
    empty: 'Nothing matches',
    orders: 'Orders',
    products: 'Products',
    orderLabel: (n: number, who: string | null) => `#${n}${who ? `, ${who}` : ''}`,
  },
  account: 'Account',
  toggleTheme: 'Toggle theme',
  notifications: { label: 'Notifications', empty: 'Nothing to catch up on.' },
} as const

/** A section is active for its own path and everything nested under it; home only for itself. */
export function isSectionActive(pathname: string, item: NavItem): boolean {
  if (item.href === '/') return pathname === item.href
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

/** A child is active for its exact path or its own nested pages. */
export function isChildActive(pathname: string, child: NavChild): boolean {
  return pathname === child.href || pathname.startsWith(`${child.href}/`)
}

/**
 * The section link highlights when the section is active but no child is, so
 * `/orders/123` lights "Orders" while `/orders/drafts` lights "Drafts".
 */
export function isSectionLinkActive(pathname: string, item: NavItem): boolean {
  if (!isSectionActive(pathname, item)) return false
  return !(item.children ?? []).some((c) => isChildActive(pathname, c))
}
