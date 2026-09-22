function under(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

/** Top-bar title per section, longest prefix wins. */
const PAGE_TITLES: [prefix: string, title: string][] = [
  ['/orders', 'Orders'],
  ['/orders/drafts', 'Draft orders'],
  ['/orders/abandoned-checkouts', 'Abandoned checkouts'],
  ['/products', 'Products'],
  ['/products/collections', 'Collections'],
  ['/products/inventory', 'Inventory'],
  ['/products/purchase-orders', 'Purchase orders'],
  ['/products/transfers', 'Transfers'],
  ['/products/gift-cards', 'Gift cards'],
  ['/customers', 'Customers'],
  ['/customers/segments', 'Segments'],
  ['/content', 'Content'],
  ['/content/files', 'Files'],
  ['/content/metaobjects', 'Metaobjects'],
  ['/analytics', 'Analytics'],
  ['/analytics/reports', 'Reports'],
  ['/analytics/live', 'Live view'],
  ['/marketing', 'Marketing'],
  ['/marketing/campaigns', 'Campaigns'],
  ['/marketing/automations', 'Automations'],
  ['/discounts', 'Discounts'],
  ['/online-store', 'Online Store'],
  ['/online-store/themes', 'Themes'],
  ['/online-store/pages', 'Pages'],
  ['/online-store/blog', 'Blog posts'],
  ['/online-store/navigation', 'Navigation'],
  ['/online-store/preferences', 'Preferences'],
  ['/apps', 'Apps'],
  ['/settings', 'Settings'],
  ['/settings/general', 'General'],
  ['/settings/payments', 'Payments'],
  ['/settings/shipping', 'Shipping'],
  ['/settings/notifications', 'Notifications'],
  ['/settings/files', 'Files'],
  ['/settings/staff', 'Staff'],
  ['/settings/domains', 'Domains'],
  ['/settings/invoices', 'Invoices'],
  ['/dev', 'Developer'],
]

export function pageTitleFor(pathname: string): string {
  if (pathname === '/') return layoutContent.dashboard
  const hit = PAGE_TITLES.filter(([p]) => under(pathname, p)).sort(
    (a, b) => b[0].length - a[0].length,
  )[0]
  return hit?.[1] ?? layoutContent.dashboard
}

/** List pages drawn to frame 5:2353 carry their own "Order List" style heading under the bar. */
const HEADED_LISTS = ['/orders', '/products']

/**
 * The top bar shows the section name. Pages with a heading of their own (a
 * list from the kit, an order, a product, the editor) render it as the h1
 * and the bar drops to plain text so the page has a single h1.
 */
export function hasOwnHeading(pathname: string): boolean {
  if (pathname === '/') return false
  if (HEADED_LISTS.includes(pathname)) return true
  return !PAGE_TITLES.some(([p]) => p === pathname)
}

export const layoutContent = {
  dashboard: 'Dashboard',
  details: 'Details',
  noChange: 'No change',
  moreActions: 'More actions',
  filter: 'Filter',
  skipToContent: 'Skip to content',
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
  noStore: 'No store selected',
  toggleTheme: 'Toggle theme',
} as const
