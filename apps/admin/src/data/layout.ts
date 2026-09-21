/**
 * Routes already rebuilt on shadcn. Everything else still renders inside the
 * Polaris Frame until its own migration PR lands; when this list covers every
 * page, delete it along with @shopify/polaris.
 */
export const SHADCN_ROUTES = ['/', '/orders'] as const

export function isShadcnRoute(pathname: string): boolean {
  return SHADCN_ROUTES.some((r) => (r === '/' ? pathname === '/' : pathname === r))
}

export const layoutContent = {
  noStore: 'No store selected',
  toggleTheme: 'Toggle theme',
} as const
