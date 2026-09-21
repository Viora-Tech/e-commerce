import type { LucideIcon } from 'lucide-react'
import {
  BadgePercent,
  Blocks,
  FileText,
  Home,
  Images,
  LayoutGrid,
  ListTree,
  Package,
  Palette,
  Settings,
  ShoppingBag,
  Users,
} from 'lucide-react'

export type NavItem = {
  href: string
  label: string
  icon: LucideIcon
  /** Highlight for every path under this prefix; defaults to the item's own path. */
  match?: string
  /** Placeholder link until the page exists — never shown as active. */
  soon?: boolean
}
export type NavGroup = { label: string; items: NavItem[] }

/** Sidebar sections, in order. Route structure stays Shopify's; grouping follows the kit. */
export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Main menu',
    items: [
      { href: '/', label: 'Home', icon: Home },
      { href: '/orders', label: 'Orders', icon: ShoppingBag },
      { href: '/customers', label: 'Customers', icon: Users },
      { href: '/discounts', label: 'Discounts', icon: BadgePercent },
    ],
  },
  {
    label: 'Product',
    items: [
      { href: '/products', label: 'Products', icon: Package, match: '/products' },
      { href: '/products', label: 'Collections', icon: LayoutGrid, soon: true },
      { href: '/products', label: 'Media', icon: Images, soon: true },
    ],
  },
  {
    label: 'Online store',
    items: [
      { href: '/online-store/pages', label: 'Pages', icon: FileText },
      { href: '/online-store/themes', label: 'Themes', icon: Palette },
      { href: '/online-store/navigation', label: 'Navigation', icon: ListTree },
    ],
  },
  {
    label: 'Apps',
    items: [{ href: '/apps', label: 'Apps', icon: Blocks }],
  },
  {
    label: 'Admin',
    items: [{ href: '/settings', label: 'Settings', icon: Settings }],
  },
]

export const navigationContent = {
  pickStore: 'Pick a store',
  stores: 'Stores',
  allStores: 'All stores',
  storesAvailable: (n: number) => `${n} available`,
  viewStore: 'View store',
  signOut: 'Sign out',
  collapse: 'Collapse sidebar',
  search: {
    placeholder: 'Search orders, products…',
    shortcut: '⌘K',
    empty: 'Nothing matches',
    orders: 'Orders',
    products: 'Products',
    orderLabel: (n: number, who: string | null) => `#${n}${who ? ` · ${who}` : ''}`,
  },
  notifications: {
    label: 'Notifications',
    empty: 'You are all caught up.',
  },
  account: 'Account',
  toggleTheme: 'Toggle theme',
} as const

/** Active when the path is the item's own path (exact for home) or nested under `match`. */
export function isNavActive(pathname: string, item: NavItem): boolean {
  if (item.soon) return false
  const prefix = item.match ?? item.href
  if (prefix === '/') return pathname === '/'
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}
