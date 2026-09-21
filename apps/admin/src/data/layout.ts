/**
 * Pages still rendered inside the Polaris Frame (Toast + ContextualSaveBar
 * context) until their own migration PR lands. Everything else is shadcn.
 * When this list is empty, delete it along with @shopify/polaris.
 */
export const POLARIS_ROUTES = [
  '/online-store/pages',
  '/apps',
  '/settings/payments',
  '/settings/shipping',
  '/settings/notifications',
  '/dev',
] as const

function under(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export function isShadcnRoute(pathname: string): boolean {
  return !POLARIS_ROUTES.some((r) => under(pathname, r))
}

/** Top-bar title per section, longest prefix wins. */
const PAGE_TITLES: [prefix: string, title: string][] = [
  ['/orders', 'Orders'],
  ['/orders/drafts', 'Draft orders'],
  ['/orders/abandoned-checkouts', 'Abandoned checkouts'],
  ['/products', 'Products'],
  ['/products/collections', 'Collections'],
  ['/products/inventory', 'Inventory'],
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

export const layoutContent = {
  dashboard: 'Dashboard',
  details: 'Details',
  filter: 'Filter',
  seeMore: 'See more',
  viewAll: 'View all',
  noStore: 'No store selected',
  toggleTheme: 'Toggle theme',
} as const
