import type { NavigationItem, StoreTx } from '@commerce/db'
import { navigationMenu } from '@commerce/db'
import { asc, eq, sql } from 'drizzle-orm'

export type NavigationMenuListRow = {
  id: string
  title: string
  handle: string
  itemCount: number
  updatedAt: Date
}

export async function listMenus(tx: StoreTx): Promise<NavigationMenuListRow[]> {
  return tx
    .select({
      id: navigationMenu.id,
      title: navigationMenu.title,
      handle: navigationMenu.handle,
      // Every item at every level, not just the top row of the menu.
      itemCount: sql<number>`jsonb_array_length(jsonb_path_query_array(${navigationMenu.items}, 'strict $.**.id'))`,
      updatedAt: navigationMenu.updatedAt,
    })
    .from(navigationMenu)
    .orderBy(asc(navigationMenu.title))
}

export async function getMenu(tx: StoreTx, id: string) {
  const [row] = await tx.select().from(navigationMenu).where(eq(navigationMenu.id, id))
  return row ?? null
}

export async function saveMenu(
  tx: StoreTx,
  storeId: string,
  input: { id?: string | undefined; title: string; handle: string; items: NavigationItem[] },
) {
  if (input.id) {
    const [row] = await tx
      .update(navigationMenu)
      .set({ title: input.title, handle: input.handle, items: input.items, updatedAt: new Date() })
      .where(eq(navigationMenu.id, input.id))
      .returning()
    return row ?? null
  }
  const [row] = await tx
    .insert(navigationMenu)
    .values({ storeId, title: input.title, handle: input.handle, items: input.items })
    .returning()
  return row ?? null
}

/** Returns the handle of the menu that was removed, or null when there was none. */
export async function deleteMenu(tx: StoreTx, id: string) {
  const [row] = await tx
    .delete(navigationMenu)
    .where(eq(navigationMenu.id, id))
    .returning({ handle: navigationMenu.handle })
  return row?.handle ?? null
}
