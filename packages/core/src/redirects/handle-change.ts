/**
 * SOURCE OF TRUTH: what happens when a product, collection or page changes its handle
 * WHAT:  `onHandleChange` keeps old links working: a 301 from the old path to the new one
 *        (source `auto`), any redirect that pointed at the old path now points at the new one
 *        (no chains), a redirect from the new path is dropped (it would hide the live page,
 *        because the proxy checks redirects first), and menu items that linked to the old
 *        handle follow it.
 * WHY:   A renamed product used to break every bookmark, search result and menu pointing at it.
 * WHERE: core `updateProduct` and `updateCollection`, API product patch and `updatePage`.
 */
import { type NavigationItem, navigationMenu, type StoreTx, urlRedirect } from '@commerce/db'
import { eq, sql } from 'drizzle-orm'
import { normaliseRedirectPath } from './paths'

export type HandleKind = 'product' | 'collection' | 'page'

const PREFIX: Record<HandleKind, string> = {
  product: '/products/',
  collection: '/collections/',
  page: '/pages/',
}

export type HandleChangeResult = { redirected: boolean; menusUpdated: number }

/** Items (at every level) of `kind` that point at `from` now point at `to`. */
export function renameMenuTargets(
  items: readonly NavigationItem[],
  kind: HandleKind,
  from: string,
  to: string,
): { items: NavigationItem[]; changed: number } {
  let changed = 0
  const walk = (list: readonly NavigationItem[]): NavigationItem[] =>
    list.map((item) => {
      const hit = item.type === kind && item.value === from
      if (hit) changed++
      const next: NavigationItem = hit ? { ...item, value: to } : item
      return item.children ? { ...next, children: walk(item.children) } : next
    })
  const out = walk(items)
  return { items: out, changed }
}

export async function onHandleChange(
  tx: StoreTx,
  storeId: string,
  kind: HandleKind,
  oldHandle: string | null | undefined,
  newHandle: string | null | undefined,
): Promise<HandleChangeResult> {
  if (!oldHandle || !newHandle || oldHandle === newHandle) {
    return { redirected: false, menusUpdated: 0 }
  }
  const fromPath = normaliseRedirectPath(`${PREFIX[kind]}${oldHandle}`)
  const target = `${PREFIX[kind]}${newHandle}`
  const livePath = normaliseRedirectPath(target)

  // The new path is live now: a redirect from it would send shoppers away from the page.
  await tx.delete(urlRedirect).where(eq(urlRedirect.path, livePath))
  // Redirects that ended at the old path go straight to the new one.
  await tx
    .update(urlRedirect)
    .set({ target, updatedAt: new Date() })
    .where(sql`lower(${urlRedirect.target}) = ${fromPath}`)
  const [existing] = await tx
    .select({ id: urlRedirect.id })
    .from(urlRedirect)
    .where(eq(urlRedirect.path, fromPath))
  if (existing) {
    await tx
      .update(urlRedirect)
      .set({ target, updatedAt: new Date() })
      .where(eq(urlRedirect.id, existing.id))
  } else {
    await tx.insert(urlRedirect).values({ storeId, path: fromPath, target, source: 'auto' })
  }

  const menus = await tx
    .select({ id: navigationMenu.id, items: navigationMenu.items })
    .from(navigationMenu)
  let menusUpdated = 0
  for (const menu of menus) {
    const renamed = renameMenuTargets(menu.items, kind, oldHandle, newHandle)
    if (renamed.changed === 0) continue
    await tx
      .update(navigationMenu)
      .set({ items: renamed.items, updatedAt: new Date() })
      .where(eq(navigationMenu.id, menu.id))
    menusUpdated++
  }
  return { redirected: true, menusUpdated }
}
