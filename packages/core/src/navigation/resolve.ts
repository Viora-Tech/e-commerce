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
