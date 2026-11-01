function under(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

/** Top-bar title per section, longest prefix wins. */
const PAGE_TITLES: [prefix: string, title: string][] = [
  ['/orders', 'Orders'],
  ['/orders/drafts', 'Draft orders'],
  ['/orders/abandoned-checkouts', 'Abandoned checkouts'],
  ['/orders/shipments', 'Shipments'],
  ['/orders/shipments/pickups', 'Pickups and manifests'],
  ['/orders/shipments/attention', 'Deliveries that need you'],
  ['/orders/returns', 'Returns'],
  ['/products', 'Products'],
  ['/products/collections', 'Collections'],
  ['/stock', 'Stock'],
  ['/stock/inventory', 'Inventory'],
  ['/stock/purchase-orders', 'Purchase orders'],
  ['/stock/transfers', 'Transfers'],
  ['/stock/inbound-shipments', 'Inbound shipments'],
  ['/stock/suppliers', 'Suppliers'],
  ['/products/gift-cards', 'Gift cards'],
  ['/products/preorders', 'Pre-orders'],
  ['/customers', 'Customers'],
  ['/customers/segments', 'Segments'],
  ['/content', 'Content'],
  ['/content/files', 'Files'],
  ['/content/metaobjects', 'Content types'],
  ['/content/menus', 'Menus'],
  ['/content/menus/redirects', 'URL redirects'],
  ['/content/blog-posts', 'Blog posts'],
  ['/analytics', 'Analytics'],
  ['/analytics/reports', 'Reports'],
  ['/analytics/live', 'Live view'],
  ['/growth', 'Growth'],
  ['/growth/attribution', 'Attribution'],
  ['/growth/autopilot', 'Autopilot'],
  ['/growth/campaigns', 'Campaigns'],
  ['/growth/automations', 'Automations'],
  ['/growth/links', 'Tracking links'],
  ['/discounts', 'Discounts'],
  ['/markets', 'Markets'],
  ['/markets/catalogs', 'Catalogs'],
  ['/markets/rollouts', 'Rollouts'],
  ['/online-store', 'Online Store'],
  ['/online-store/themes', 'Themes'],
  ['/online-store/pages', 'Pages'],
  ['/online-store/preferences', 'Preferences'],
  ['/apps', 'Apps'],
  ['/sales-channels/inbox', 'Inbox'],
  ['/sales-channels/inbox/conversations', 'Conversations'],
  ['/sales-channels/inbox/quick-replies', 'Quick replies'],
  ['/sales-channels/inbox/knowledge', 'Knowledge base'],
  ['/sales-channels/inbox/settings', 'Inbox settings'],
  ['/settings', 'Settings'],
  ['/settings/store', 'Store details'],
  ['/settings/store-health', 'Store health'],
  ['/settings/payments', 'Payments'],
  ['/settings/shipping', 'Shipping & delivery'],
  ['/settings/notifications', 'Notifications'],
  ['/settings/staff', 'Staff'],
  ['/settings/custom-data', 'Custom data'],
  ['/settings/domains', 'Domains'],
  ['/settings/invoices', 'Invoices'],
  ['/content/files/storage', 'File storage'],
  ['/account', 'Account'],
  ['/account/security', 'Sign-in & security'],
  ['/account/sessions', 'Sessions'],
  ['/account/notifications', 'Notifications'],
  ['/account/stores', 'Stores'],
  ['/account/language', 'Language & region'],
  ['/account/appearance', 'Appearance'],
  ['/dev', 'Developer'],
]

/** The route titles, for the test that checks Hindi page names only name real routes. */
export const PAGE_TITLES_FOR_TESTS: readonly (readonly [string, string])[] = PAGE_TITLES

/** The section route whose title the top bar shows for `pathname`, or null for the dashboard. */
export function pagePrefixFor(pathname: string): string | null {
  if (pathname === '/') return null
  const hit = PAGE_TITLES.filter(([p]) => under(pathname, p)).sort(
    (a, b) => b[0].length - a[0].length,
  )[0]
  return hit?.[0] ?? null
}

export function pageTitleFor(pathname: string): string {
  const prefix = pagePrefixFor(pathname)
  return PAGE_TITLES.find(([p]) => p === prefix)?.[1] ?? layoutContent.dashboard
}

/**
 * Section pages that render no header of their own; the frame draws their title row.
 * Every other page (lists, details, settings sections) renders its own PageHeader, so the
 * frame adds nothing and the title appears once.
 */
const UNHEADED: string[] = []

/** True when the page draws its own h1 (PageHeader, KitListPage or the dashboard). */
export function hasOwnHeading(pathname: string): boolean {
  return !UNHEADED.includes(pathname)
}

export const layoutContent = {
  dashboard: 'Dashboard',
  details: 'Details',
  noChange: 'No change',
  moreActions: 'More actions',
  save: 'Save',
  filter: 'Filter',
  skipToContent: 'Skip to content',
  breadcrumb: 'Breadcrumb',
  notFound: {
    heading: 'Page not found',
    body: 'The link may be out of date, or the item was removed.',
    home: 'Go to dashboard',
  },
  error: {
    heading: 'This page did not load',
    body: 'Something went wrong on our side. Try again in a moment.',
    retry: 'Try again',
  },
  seeMore: 'See more',
  pagination: { label: 'Pagination', previous: 'Previous', next: 'Next' },
  search: 'Search',
  sort: 'Sort',
  filterRows: 'Filter rows',
  more: 'More',
  viewAll: 'View all',
  viewAllApps: (n: number) => `View all apps (${n})`,
  /** Last row under Apps in the sidebar: the App Store website, in a new tab. */
  appStore: 'App Store',
  noStore: 'No store selected',
  toggleTheme: 'Toggle theme',
  scroll: {
    showing: (n: string) => `Showing ${n} items · scroll for more`,
    showingAll: (n: string) => `Showing all ${n} items`,
    more: 'Scroll for more',
    expand: 'Show all',
    collapse: 'Show less',
  },
} as const
