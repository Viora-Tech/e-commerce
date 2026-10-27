import { eq, inArray } from 'drizzle-orm'
import { createDb } from './client'
import { type NavigationItem, navigationMenu } from './content-schema'
import { store } from './schema'

/**
 * Storefront menus for the Waimers store, and the pointer saying which of them
 * the header and footer render. Every menu is recognised by its handle, so a
 * rerun replaces exactly these and nothing a merchant added.
 *
 * Deliberately absent: the old Help column (track order, shipping, returns,
 * contact). Not one of those destinations exists as a route, and a column of
 * dead links is worse than a missing column. Add it back once the pages do.
 *
 * Destinations are the collections that actually exist. The menu it replaces
 * pointed at `mice`, `keyboards` and `glass-mousepads`, which were never seeded.
 * For the same reason the main menu nests only what exists: Shop opens the mega
 * menu (Mousepads groups Glasspads and Premium picks), Brands a plain dropdown.
 */

type ItemSeed = {
  title: string
  type: NavigationItem['type']
  value?: string
  children?: ItemSeed[]
}

type MenuSeed = { handle: string; title: string; items: ItemSeed[] }

const collection = (title: string, value: string, children?: ItemSeed[]): ItemSeed => ({
  title,
  type: 'collection',
  value,
  ...(children ? { children } : {}),
})

const mainItems: ItemSeed[] = [
  {
    title: 'Shop',
    type: 'url',
    value: '/collections',
    children: [
      collection('Mousepads', 'mousepads', [
        collection('Glasspads', 'glasspads'),
        collection('Premium picks', 'premium'),
      ]),
      collection('Best sellers', 'best-sellers'),
    ],
  },
  {
    title: 'Brands',
    type: 'url',
    value: '/collections',
    children: [collection('Pulsar', 'pulsar'), collection('Talongames', 'talongames')],
  },
  collection('Best sellers', 'best-sellers'),
]

const shopItems: ItemSeed[] = [
  collection('Best sellers', 'best-sellers'),
  collection('Mousepads', 'mousepads'),
  collection('Glasspads', 'glasspads'),
  collection('Premium picks', 'premium'),
]

const MENUS: MenuSeed[] = [
  { handle: 'main-menu', title: 'Main menu', items: mainItems },
  { handle: 'footer-shop', title: 'Shop', items: shopItems },
  {
    handle: 'footer-community',
    title: 'Community',
    items: [
      { title: 'Discord', type: 'url', value: 'https://discord.gg/waimers' },
      { title: 'Instagram', type: 'url', value: 'https://instagram.com/waimers' },
    ],
  },
]

const HANDLES = MENUS.map((m) => m.handle)

/** Which menu the header renders, and which the footer renders as columns, in order. */
const SETTINGS = { main: 'main-menu', footer: ['footer-shop', 'footer-community'] }

/** Item ids are stable per position in the tree, which is enough for keys and for editing. */
function itemsFor(items: ItemSeed[], prefix: string): NavigationItem[] {
  return items.map((item, i) => {
    const id = `${prefix}-${i + 1}`
    return {
      id,
      title: item.title,
      type: item.type,
      ...(item.value === undefined ? {} : { value: item.value }),
      ...(item.children ? { children: itemsFor(item.children, id) } : {}),
    }
  })
}

export async function seedNavigation(ownerUrl: string, opts: { clean?: boolean } = {}) {
  const db = createDb(ownerUrl)
  try {
    const [s] = await db.select().from(store).where(eq(store.slug, 'waimers'))
    if (!s) throw new Error('seed the store first (bun run db:seed)')

    const existing = await db
      .select({ id: navigationMenu.id })
      .from(navigationMenu)
      .where(inArray(navigationMenu.handle, HANDLES))
    if (existing.length > 0) {
      await db.delete(navigationMenu).where(inArray(navigationMenu.handle, HANDLES))
    }
    if (opts.clean) {
      await db.update(store).set({ navigation: null }).where(eq(store.id, s.id))
      console.log(`nav: removed ${existing.length} menus`)
      return
    }

    for (const menu of MENUS) {
      await db.insert(navigationMenu).values({
        storeId: s.id,
        handle: menu.handle,
        title: menu.title,
        items: itemsFor(menu.items, menu.handle),
      })
      console.log(`nav: ${menu.title} with ${menu.items.length} items`)
    }

    await db.update(store).set({ navigation: SETTINGS }).where(eq(store.id, s.id))
    console.log(`nav: header=${SETTINGS.main} footer=${SETTINGS.footer.join(', ')}`)
  } finally {
    await db.$client.end()
  }
}

if ((import.meta as { main?: boolean }).main) {
  const url = process.env.DATABASE_URL_OWNER
  if (!url) throw new Error('DATABASE_URL_OWNER is required')
  await seedNavigation(url, { clean: process.argv.includes('--clean') })
}
