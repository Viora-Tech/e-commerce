import { appStoreUrl, siteConfig } from '@commerce/config/site'
import { type Permission, permissions } from '@commerce/core/permissions'
import type { LucideIcon } from '@commerce/ui/icons'
import { Blocks, Braces, Palette, Plus, Settings, TrendingUp, Truck } from '@commerce/ui/icons'
import { routes } from '@/lib/routes'
import { ACCOUNT_NAV } from './account'
import { CUSTOM_DATA_OWNERS } from './custom-data'
import { customDataContent } from './metaobjects'
import { NAV_GROUPS, SETTINGS_NAV } from './navigation'
import { SETTINGS_SECTIONS } from './settings'

/** One place the palette can take you: a page, or a create screen. */
export type PaletteLink = {
  label: string
  /** The section it lives in, shown as the breadcrumb ("Orders › Drafts"). */
  hint?: string
  /** The section's route, so its name can be shown in the member's language. */
  hintHref?: string
  href: string
  icon: LucideIcon
  /** Hidden from members who do not hold it; the server still guards the page. */
  permission?: Permission
  /** The keys that jump straight there (G then O). */
  shortcut?: string[]
}

export const paletteContent = {
  title: 'Search',
  description: `Search orders, products, customers and pages, or ask ${siteConfig.brand.name} AI.`,
  placeholder: `Search or ask ${siteConfig.brand.name} AI…`,
  esc: 'Esc',
  scopesLabel: 'Search in',
  scopes: {
    all: 'All',
    orders: 'Orders',
    products: 'Products',
    customers: 'Customers',
    pages: 'Pages',
    settings: 'Settings',
  },
  sections: {
    recent: 'Recent',
    actions: 'Quick actions',
    goTo: 'Go to',
    orders: 'Orders',
    products: 'Products',
    customers: 'Customers',
    pages: 'Pages',
    settings: 'Settings',
  },
  actions: {
    createProduct: 'Create product',
    createOrder: 'Create order',
    createDiscount: 'Create discount',
    createPurchaseOrder: 'Create purchase order',
    openCustomize: 'Open Customize',
  },
  clearRecent: 'Clear',
  askAi: (query: string) => `Ask ${siteConfig.brand.name} AI: “${query}”`,
  askAiHint: 'Get an answer from your store data',
  seeAll: (n: number) => `See all ${n} →`,
  toggleTheme: 'Switch between light and dark',
  settings: 'Settings',
  account: 'Your account',
  /** The App Store website (opens a new tab). */
  appStore: 'App Store',
  breadcrumbSeparator: ' › ',
  order: { guest: 'Guest' },
  product: {
    inStock: (n: number) => `${n} in stock`,
    outOfStock: 'Out of stock',
    from: (price: string) => `From ${price}`,
  },
  customer: {
    orders: (n: number) => (n === 1 ? '1 order' : `${n} orders`),
    noOrders: 'No orders yet',
  },
  typeToSearch: {
    orders: 'Type an order number, a name or an email to find orders.',
    products: 'Type a product name, type or brand to find products.',
    customers: 'Type a name, an email or a phone number to find customers.',
  },
  browse: {
    orders: 'Browse all orders',
    products: 'Browse all products',
    customers: 'Browse all customers',
  },
  loading: 'Searching…',
  count: (n: number) => (n === 1 ? '1 result' : `${n} results`),
  noResults: (query: string) => `No results for “${query}”`,
  noResultsBody: `Check the spelling, try fewer words, or ask ${siteConfig.brand.name} AI.`,
  tips: [
    'Order numbers work with or without the #',
    'Phone numbers need at least 4 digits',
    'Try a setting like UPI, GST or courier',
  ],
  error: {
    title: 'Search did not load',
    body: 'Check your connection and try again.',
    retry: 'Try again',
  },
  footer: {
    move: 'Move',
    open: 'Open',
    newTab: 'New tab',
    close: 'Close',
    scope: 'Switch filter',
    keys: { move: '↑↓', open: '↵', scope: 'Tab', close: 'Esc' },
  },
} as const

/** `G` then a second key jumps straight to a section, Gmail-style. */
export const GO_TO_ROUTES: Record<string, string> = {
  o: routes.orders.list(),
  p: routes.products.list(),
  c: routes.customers.list(),
  a: routes.account.home(),
  ',': routes.settings.home(),
}

export const shortcutsContent = {
  title: 'Keyboard shortcuts',
  description: 'Work faster without leaving the keyboard.',
  groups: [
    {
      label: 'Everywhere',
      items: [
        { keys: ['⌘', 'K'], label: 'Open search' },
        { keys: ['/'], label: 'Open search' },
        { keys: ['⌘', '↵'], label: 'Open a search result in a new tab' },
        { keys: ['⌘', 'J'], label: 'Open or close the AI assistant' },
        { keys: ['?'], label: 'Show this list' },
        { keys: ['Esc'], label: 'Close a dialog or panel' },
      ],
    },
    {
      label: 'Go to',
      items: [
        { keys: ['G', 'O'], label: 'Orders' },
        { keys: ['G', 'P'], label: 'Products' },
        { keys: ['G', 'C'], label: 'Customers' },
        { keys: ['G', 'A'], label: 'Account' },
        { keys: ['G', ','], label: 'Settings' },
      ],
    },
    {
      label: 'On a list page',
      items: [{ keys: ['N'], label: 'Add new' }],
    },
  ],
} as const

/** A create or open shortcut; its words are in `paletteContent.actions`. */
export type QuickAction = {
  id: keyof typeof paletteContent.actions
  href: string
  icon: LucideIcon
  permission: Permission
}

/** Quick actions: create screens, shown on an empty search and when their words match. */
export const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'createProduct',
    href: routes.products.new(),
    icon: Plus,
    permission: permissions.PRODUCTS_WRITE,
  },
  {
    id: 'createOrder',
    href: routes.orders.newDraft(),
    icon: Plus,
    permission: permissions.DRAFTS_WRITE,
  },
  {
    id: 'createDiscount',
    href: routes.discounts.new(),
    icon: Plus,
    permission: permissions.DISCOUNTS_WRITE,
  },
  {
    id: 'createPurchaseOrder',
    href: routes.stock.newPurchaseOrder(),
    icon: Plus,
    permission: permissions.INVENTORY_WRITE,
  },
  {
    id: 'openCustomize',
    href: routes.onlineStore.themes(),
    icon: Palette,
    permission: permissions.ONLINE_STORE_WRITE,
  },
]

/** The keys that follow G for each top-level page, keyed by its href. */
const GO_TO_SHORTCUTS: Record<string, string[]> = Object.fromEntries(
  Object.entries(GO_TO_ROUTES).map(([key, href]) => [href, ['G', key.toUpperCase()]]),
)

/** Every rail page and sub-page (sub-pages carry their section as the breadcrumb), and your account. */
export const PAGE_LINKS: PaletteLink[] = [
  ...NAV_GROUPS.flatMap((group) =>
    group.items.flatMap((item): PaletteLink[] => [
      {
        label: item.label,
        href: item.href,
        icon: item.icon,
        ...(item.permission ? { permission: item.permission } : {}),
        ...(GO_TO_SHORTCUTS[item.href] ? { shortcut: GO_TO_SHORTCUTS[item.href] } : {}),
      },
      ...(item.children ?? []).map((child): PaletteLink => {
        const permission = child.permission ?? item.permission
        return {
          label: child.label,
          hint: item.label,
          hintHref: item.href,
          href: child.href,
          icon: item.icon,
          ...(permission ? { permission } : {}),
        }
      }),
    ]),
  ),
  // Growth pages that left the rail: tracking links are a Campaigns tab, automations are
  // moving to their own app.
  ...[
    { label: 'Tracking links', href: routes.growth.links() },
    { label: 'Marketing automations', href: routes.growth.automations() },
  ].map(
    (p): PaletteLink => ({
      ...p,
      hint: 'Growth',
      hintHref: routes.growth.home(),
      icon: TrendingUp,
      permission: permissions.MARKETING_READ,
    }),
  ),
  // The queues beside the Shipments table, each on its own page.
  ...[
    { label: 'Pickups and manifests', href: routes.orders.shipmentPickups() },
    { label: 'Deliveries that need you', href: routes.orders.shipmentProblems() },
  ].map(
    (p): PaletteLink => ({
      ...p,
      hint: 'Shipments',
      hintHref: routes.orders.shipments(),
      icon: Truck,
      permission: permissions.ORDERS_READ,
    }),
  ),
  // Settings → Custom data: each kind of record's extra fields has its own page.
  ...CUSTOM_DATA_OWNERS.map(
    (o): PaletteLink => ({
      label: customDataContent.metafields.heading(customDataContent.owners[o.owner]),
      hint: customDataContent.title,
      hintHref: routes.settings.customData(),
      href: routes.settings.customDataOwner(o.slug),
      icon: Braces,
      permission: permissions.SETTINGS_READ,
    }),
  ),
  { label: SETTINGS_NAV.label, href: SETTINGS_NAV.href, icon: SETTINGS_NAV.icon },
  ...ACCOUNT_NAV.map(
    (p): PaletteLink => ({
      label: p.title,
      hint: paletteContent.account,
      href: p.href,
      icon: p.icon,
    }),
  ),
  // Apps are browsed and installed on the App Store website, not in the admin.
  {
    label: paletteContent.appStore,
    href: appStoreUrl(),
    icon: Blocks,
    permission: permissions.SETTINGS_READ,
  },
]

/** Settings sections as palette links, for the Settings scope with nothing typed. */
export const SETTINGS_LINKS: PaletteLink[] = SETTINGS_SECTIONS.map(
  (s): PaletteLink => ({
    label: s.title,
    hint: paletteContent.settings,
    href: s.href,
    icon: Settings,
    permission: permissions.SETTINGS_READ,
  }),
)
