import type { LucideIcon } from '@commerce/ui/icons'
import { Plus, Settings } from '@commerce/ui/icons'
import { NAV_GROUPS, SETTINGS_NAV } from './navigation'
import { SETTINGS_SECTIONS } from './settings'

/** One place the palette can take you: a page, or a create screen. */
export type PaletteLink = { label: string; hint?: string; href: string; icon: LucideIcon }

export const commandContent = {
  placeholder: 'Search or jump to',
  field: 'Search orders, products, customers or pages',
  actions: 'Actions',
  pages: 'Go to',
  orders: 'Orders',
  products: 'Products',
  customers: 'Customers',
  empty: 'Nothing matches',
  toggleTheme: 'Switch between light and dark',
  settings: 'Settings',
} as const

/** Create shortcuts, the palette's "Actions" group. */
export const CREATE_LINKS: PaletteLink[] = [
  { label: 'Create product', href: '/products/new', icon: Plus },
  { label: 'Create order', href: '/orders/drafts', icon: Plus },
  { label: 'Create discount', href: '/discounts/new', icon: Plus },
  { label: 'Create collection', href: '/products/collections/new', icon: Plus },
]

/** Every rail page and sub-page, plus each Settings section. */
export const PAGE_LINKS: PaletteLink[] = [
  ...NAV_GROUPS.flatMap((group) =>
    group.items.flatMap((item) => [
      { label: item.label, href: item.href, icon: item.icon },
      ...(item.children ?? []).map((child) => ({
        label: child.label,
        hint: item.label,
        href: child.href,
        icon: item.icon,
      })),
    ]),
  ),
  { label: SETTINGS_NAV.label, href: SETTINGS_NAV.href, icon: SETTINGS_NAV.icon },
  ...SETTINGS_SECTIONS.map((s) => ({
    label: s.title,
    hint: commandContent.settings,
    href: s.href,
    icon: Settings,
  })),
]
