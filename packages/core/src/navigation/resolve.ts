import type { NavigationItem, NavigationItemType } from '@commerce/db'

/** A menu item as it renders. Matches the blocks package's NavLink. */
export type NavLink = { label: string; href: string }

/**
 * Public path prefixes, keyed by item type. An item stores the handle rather
 * than an id, so resolving is string work with no lookup behind it. The cost of
 * that choice is that renaming a handle breaks any menu pointing at it.
 */
const PREFIX: Record<Extract<NavigationItemType, 'product' | 'collection' | 'page'>, string> = {
  product: '/products/',
  collection: '/collections/',
  page: '/pages/',
}

/**
 * The public path an item points at, or null when it cannot resolve: a url item
 * with no value, or a typed item with its destination unset. Public paths carry
 * no store prefix, the proxy adds it.
 */
export function itemHref(item: NavigationItem): string | null {
  if (item.type === 'home') return '/'
  const value = item.value?.trim()
  if (!value) return null
  return item.type === 'url' ? value : `${PREFIX[item.type]}${value}`
}

/** The items that resolve, in order, as links the storefront can render. */
export function toNavLinks(items: readonly NavigationItem[]): NavLink[] {
  const links: NavLink[] = []
  for (const item of items) {
    const href = itemHref(item)
    if (href !== null) links.push({ label: item.title, href })
  }
  return links
}
