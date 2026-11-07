/** SOURCE OF TRUTH: what a store's link previews fall back to — WHAT: the store's name and its saved SEO preferences / WHY: the storefront's layout and its pages all need the same fallback, and only core reads the store table */
import { type StoreTx, store } from '@commerce/db'
import { eq } from 'drizzle-orm'
import { parsePreferences } from './preferences'

export async function storeShareSettings(tx: StoreTx, storeId: string) {
  const [s] = await tx
    .select({ name: store.name, preferences: store.preferences })
    .from(store)
    .where(eq(store.id, storeId))
  return s ? { name: s.name, seo: parsePreferences(s.preferences).seo } : null
}
