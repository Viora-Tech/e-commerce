import type { NavigationItem, NavigationItemType } from '@commerce/db'

/** A menu item as it renders, with its nested items. Matches the blocks package's NavLink. */
export type NavLink = {
  /** The menu item's id: stable, unique within the menu, so it keys the rendered list. */
  id: string
  label: string
  href: string
  children?: NavLink[] | undefined
}

/** A footer column: a heading over a list of links. */
export type NavColumn = { id: string; heading: string; links: NavLink[] }

/**
 * Public path prefixes for the types that store a handle (an article stores
 * `blog/article`, a policy its type). An item stores the handle rather than an
 * id, so resolving is string work with no lookup behind it; when a product,
 * collection or page handle changes, `onHandleChange` rewrites the menus.
 */
const PREFIX: Record<
  Extract<NavigationItemType, 'product' | 'collection' | 'page' | 'blog' | 'article' | 'policy'>,
  string
> = {
  product: '/products/',
  collection: '/collections/',
  page: '/pages/',
  blog: '/blogs/',
  article: '/blogs/',
  policy: '/policies/',
}

/** Fixed paths for the types that need no value. */
const FIXED: Partial<Record<NavigationItemType, string>> = {
  home: '/',
  search: '/search',
  collections: '/collections',
}

/**
 * The public path for a type and value, or null when a typed item has no
 * destination. Public paths carry no store prefix, the proxy adds it. The admin
 * menu editor shows the same string as "links to".
 */
export function itemPath(type: NavigationItemType, value: string | undefined): string | null {
  const fixed = FIXED[type]
  if (fixed) return fixed
  const v = value?.trim()
  if (!v) return null
  return type === 'url' ? v : `${PREFIX[type as keyof typeof PREFIX]}${v}`
}

/** The public path an item points at, or null when it cannot resolve. */
export function itemHref(item: NavigationItem): string | null {
  return itemPath(item.type, item.value)
}

/**
 * The items that resolve, in order and nested, as links the storefront can
 * render. An item that does not resolve is dropped along with its children:
 * validation requires every item to have a destination, so this only happens
 * to data written before that rule.
 */
export function toNavLinks(items: readonly NavigationItem[]): NavLink[] {
  const links: NavLink[] = []
  for (const item of items) {
    const href = itemHref(item)
    if (href === null) continue
    const children = toNavLinks(item.children ?? [])
    const link = { id: item.id, label: item.title, href }
    links.push(children.length > 0 ? { ...link, children } : link)
  }
  return links
}

/**
 * Footer columns for one menu. A flat menu is one column under the menu's
 * title. A nested menu reads like Shopify's footer: each top-level item that
 * has children becomes its own column, and any top-level links without
 * children are gathered into a column under the menu's title.
 */
export function toFooterColumns(
  menu: { id: string; title: string },
  items: readonly NavigationItem[],
): NavColumn[] {
  const links = toNavLinks(items)
  const grouped = links.filter((l) => (l.children?.length ?? 0) > 0)
  if (grouped.length === 0) {
    return links.length > 0 ? [{ id: menu.id, heading: menu.title, links }] : []
  }
  const loose = links.filter((l) => (l.children?.length ?? 0) === 0)
  const columns = grouped.map((l) => ({
    id: l.id,
    heading: l.label,
    links: (l.children ?? []).map(({ id, label, href }) => ({ id, label, href })),
  }))
  return loose.length > 0
    ? [{ id: menu.id, heading: menu.title, links: loose }, ...columns]
    : columns
}
