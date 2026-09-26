function under(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

/** Top-bar title per section, longest prefix wins. */
const PAGE_TITLES: [prefix: string, title: string][] = [
  ['/orders', 'Orders'],
  ['/orders/drafts', 'Draft orders'],
  ['/orders/abandoned-checkouts', 'Abandoned checkouts'],
  ['/orders/shipments', 'Shipments'],
  ['/orders/returns', 'Returns'],
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
  ['/content/menus', 'Menus'],
  ['/content/menus/redirects', 'URL redirects'],
  ['/content/blog-posts', 'Blog posts'],
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
  ['/online-store/preferences', 'Preferences'],
  ['/apps', 'Apps'],
  ['/settings', 'Settings'],
  ['/settings/general', 'General'],
  ['/settings/payments', 'Payments'],
  ['/settings/shipping', 'Shipping'],
  ['/settings/notifications', 'Notifications'],
  ['/settings/files', 'Files'],
  ['/settings/staff', 'Staff'],
  ['/settings/custom-data', 'Custom data'],
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

/**
 * Section pages that render no header of their own; the frame draws their title row.
 * Every other page (lists, details, settings sections) renders its own PageHeader, so the
 * frame adds nothing and the title appears once.
 */
const UNHEADED = ['/content', '/content/menus', '/content/menus/redirects', '/online-store/pages']

/** True when the page draws its own h1 (PageHeader, KitListPage or the dashboard). */
export function hasOwnHeading(pathname: string): boolean {
  return !UNHEADED.includes(pathname)
}

export const layoutContent = {
  dashboard: 'Dashboard',
  details: 'Details',
  noChange: 'No change',
  moreActions: 'More actions',
  filter: 'Filter',
  skipToContent: 'Skip to content',
  breadcrumb: 'Breadcrumb',
  backTo: (label: string) => `Back to ${label}`,
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
