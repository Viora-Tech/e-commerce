/**
 * The store page Customize's Preview button opens: the page the template being edited draws.
 * A product, collection or page template opens the one chosen in the resource picker (the home
 * page until one is chosen); an alternate adds `?view=<suffix>`, which the storefront's template
 * render reads in a theme preview. Plain logic, no React.
 */

type ResourceLike =
  | { kind: 'product'; product: { handle: string } }
  | { kind: 'collection' | 'page'; handle?: string | undefined }
  | { kind: string }
  | null

/** Pages with a fixed address. Blogs and posts have no picker yet, so they open the home page. */
const FIXED: Record<string, string> = {
  home: '/',
  cart: '/cart',
  search: '/search',
  not_found: '/404',
  account: '/account',
  login: '/account/login',
}

const PREFIX: Record<string, string> = {
  product: '/products/',
  collection: '/collections/',
  page: '/pages/',
}

function handleOf(resource: ResourceLike): string | null {
  if (!resource) return null
  if ('product' in resource) return resource.product.handle || null
  if ('handle' in resource && typeof resource.handle === 'string') return resource.handle || null
  return null
}

export function customizePreviewPath(
  template: string,
  suffix: string,
  resource: ResourceLike,
): string {
  const prefix = PREFIX[template]
  const handle = prefix && resource?.kind === template ? handleOf(resource) : null
  const path = prefix ? (handle ? `${prefix}${encodeURIComponent(handle)}` : null) : FIXED[template]
  if (!path) return '/'
  return suffix ? `${path}?view=${encodeURIComponent(suffix)}` : path
}
