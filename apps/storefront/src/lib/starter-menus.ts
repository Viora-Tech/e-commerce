import 'server-only'
import { toNavLinks } from '@commerce/core'
import { collectionsContent } from '@/data/collections'

/** Collections a store with no menu at all shows in its header, after "Shop all". */
export const STARTER_MENU_COLLECTIONS = 4

/** A store with no footer menu yet gets two plain columns, so its footer is never blank. */
export function starterFooterColumns(collections: readonly { handle: string; title: string }[]) {
  const copy = collectionsContent.starterFooter
  return [
    {
      id: 'starter-shop',
      heading: copy.shop,
      links: [
        { id: 'starter-all', label: collectionsContent.shopAll, href: '/collections/all' },
        ...collections.slice(0, STARTER_MENU_COLLECTIONS).map((c) => ({
          id: `starter-${c.handle}`,
          label: c.title,
          href: `/collections/${c.handle}`,
        })),
      ],
    },
    {
      id: 'starter-help',
      heading: copy.help,
      links: [
        { id: 'starter-search', label: copy.search, href: '/search' },
        { id: 'starter-track', label: copy.trackOrder, href: '/track-order' },
        { id: 'starter-account', label: copy.account, href: '/account' },
      ],
    },
  ]
}

/**
 * The Header section's menu, or the Navigation setting's main menu when it names none. A store
 * that has no such menu yet (a new store) gets Shopify's starter: Shop all and its first
 * collections, so the header is never empty. A menu the merchant emptied stays empty.
 */
export function menuLinks(
  menus: Map<string, { items: Parameters<typeof toNavLinks>[0] }>,
  handle: unknown,
  fallback: string | null,
  collections: readonly { handle: string; title: string }[],
) {
  const picked = typeof handle === 'string' && handle ? handle : fallback
  const menu = picked === null ? undefined : menus.get(picked)
  if (menu) return toNavLinks(menu.items)
  return [
    { id: 'starter-all', label: collectionsContent.shopAll, href: '/collections/all' },
    ...collections.slice(0, STARTER_MENU_COLLECTIONS).map((c) => ({
      id: `starter-${c.handle}`,
      label: c.title,
      href: `/collections/${c.handle}`,
    })),
  ]
}
