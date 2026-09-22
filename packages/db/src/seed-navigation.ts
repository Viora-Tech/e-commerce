import { eq, inArray } from 'drizzle-orm'
import { createDb } from './client'
import type { NavigationItem } from './schema'
import { navigationMenu, store } from './schema'

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
 */

type MenuSeed = {
  handle: string
  title: string
  items: { title: string; type: NavigationItem['type']; value?: string }[]
}

const mainItems = [
  { title: 'Best sellers', type: 'collection' as const, value: 'best-sellers' },
  { title: 'Mousepads', type: 'collection' as const, value: 'mousepads' },
  { title: 'Glasspads', type: 'collection' as const, value: 'glasspads' },
  { title: 'Pulsar', type: 'collection' as const, value: 'pulsar' },
  { title: 'Talongames', type: 'collection' as const, value: 'talongames' },
  { title: 'Premium picks', type: 'collection' as const, value: 'premium' },
]

const MENUS: MenuSeed[] = [
  { handle: 'main-menu', title: 'Main menu', items: mainItems },
  {
    handle: 'footer-shop',
    title: 'Shop',
    items: mainItems.filter((i) => i.value !== 'pulsar' && i.value !== 'talongames'),
  },
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

/** Item ids are stable per menu position, which is enough for keys and for editing. */
function itemsFor(menu: MenuSeed): NavigationItem[] {
  return menu.items.map((item, i) => ({
    id: `${menu.handle}-${i + 1}`,
    title: item.title,
    type: item.type,
    ...(item.value === undefined ? {} : { value: item.value }),
  }))
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
        items: itemsFor(menu),
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
