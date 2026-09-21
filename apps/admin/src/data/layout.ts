/**
 * Routes already rebuilt on shadcn. Everything else still renders inside the
 * Polaris Frame until its own migration PR lands; when this list covers every
 * page, delete it along with @shopify/polaris.
 */
export const SHADCN_ROUTES = ['/', '/orders'] as const

/** `/orders` also covers `/orders/<id>`; `/` only matches itself. */
export function isShadcnRoute(pathname: string): boolean {
  return SHADCN_ROUTES.some((r) =>
    r === '/' ? pathname === '/' : pathname === r || pathname.startsWith(`${r}/`),
  )
}

/** Top-bar title per section, longest prefix wins. */
const PAGE_TITLES: [prefix: string, title: string][] = [
  ['/orders', 'Orders'],
  ['/products', 'Products'],
  ['/customers', 'Customers'],
  ['/discounts', 'Discounts'],
  ['/online-store/pages', 'Pages'],
  ['/online-store/themes', 'Themes'],
  ['/online-store/navigation', 'Navigation'],
  ['/online-store', 'Online store'],
  ['/apps', 'Apps'],
  ['/settings/payments', 'Payments'],
  ['/settings/shipping', 'Shipping'],
  ['/settings/notifications', 'Notifications'],
  ['/settings', 'Settings'],
  ['/dev', 'Developer'],
]

export function pageTitleFor(pathname: string): string {
  if (pathname === '/') return layoutContent.dashboard
  const hit = PAGE_TITLES.filter(([p]) => pathname === p || pathname.startsWith(`${p}/`)).sort(
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
