import { parseNavigationSettings, toFooterColumns, toNavLinks } from '@commerce/core'
import { navigationMenu, type StoreTx, store } from '@commerce/db'
import { eq } from 'drizzle-orm'

/** What the Customize preview needs to draw the header and footer as the storefront does. */
export async function themePreviewContext(tx: StoreTx, storeId: string) {
  const [s] = await tx
    .select({ name: store.name, navigation: store.navigation })
    .from(store)
    .where(eq(store.id, storeId))
  const menus = await tx.select().from(navigationMenu)
  const settings = parseNavigationSettings(s?.navigation)
  const byHandle = new Map(menus.map((m) => [m.handle, m]))
  const main = settings.main === null ? undefined : byHandle.get(settings.main)
  return {
    storeName: s?.name ?? '',
    navLinks: toNavLinks(main?.items ?? []),
    footerColumns: settings.footer.flatMap((handle) => {
      const menu = byHandle.get(handle)
      return menu ? toFooterColumns(menu, menu.items) : []
    }),
  }
}
