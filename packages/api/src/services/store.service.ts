import { parseNavigationSettings } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { store } from '@commerce/db'
import { eq, sql } from 'drizzle-orm'

export async function getStore(tx: StoreTx, storeId: string) {
  const [s] = await tx.select().from(store).where(eq(store.id, storeId))
  return s ?? null
}

/**
 * Online Store › Preferences writes its own keys (seo, password, tracking) into
 * `store.preferences`, merged over what is there: policies, checkout, customer
 * privacy, customer accounts and the theme editor's "My sections" (`customSections`)
 * live in the same column and must survive.
 */
export async function updateStorePreferences(tx: StoreTx, storeId: string, preferences: unknown) {
  // `customSections` is only ever written by `saveCustomSection`; a stale copy in the form
  // must not overwrite it.
  const next = { ...((preferences ?? {}) as Record<string, unknown>) }
  delete next.customSections
  const [s] = await tx
    .update(store)
    .set({
      preferences: sql`coalesce(${store.preferences}, '{}'::jsonb) || ${JSON.stringify(next)}::jsonb`,
    })
    .where(eq(store.id, storeId))
    .returning()
  return s ?? null
}

export async function updateStoreNavigation(tx: StoreTx, storeId: string, navigation: unknown) {
  const [s] = await tx.update(store).set({ navigation }).where(eq(store.id, storeId)).returning()
  return s ?? null
}

/**
 * Drop a handle from the storefront pointer once its menu is gone. The pointer must
 * not outlive the menu it names: a dangling handle renders an empty header with
 * nothing on screen or in the admin to say why.
 */
export async function forgetNavigationHandle(tx: StoreTx, storeId: string, handle: string) {
  const s = await getStore(tx, storeId)
  if (!s) return
  const settings = parseNavigationSettings(s.navigation)
  if (settings.main !== handle && !settings.footer.includes(handle)) return
  await updateStoreNavigation(tx, storeId, {
    main: settings.main === handle ? null : settings.main,
    footer: settings.footer.filter((h) => h !== handle),
  })
}

export async function updateStorePayments(tx: StoreTx, storeId: string, payments: unknown) {
  const [s] = await tx.update(store).set({ payments }).where(eq(store.id, storeId)).returning()
  return s ?? null
}

export async function updateStorePreorder(tx: StoreTx, storeId: string, preorder: unknown) {
  const [s] = await tx.update(store).set({ preorder }).where(eq(store.id, storeId)).returning()
  return s ?? null
}

export async function updateStoreNotifications(
  tx: StoreTx,
  storeId: string,
  notifications: unknown,
) {
  const [s] = await tx.update(store).set({ notifications }).where(eq(store.id, storeId)).returning()
  return s ?? null
}

export type StoreGeneralPatch = {
  name: string
  contactEmail: string | null
  contactPhone: string | null
  address: unknown
  /** Left out: Settings › General no longer edits tax, so it cannot overwrite Taxes & GST. */
  gstin?: string | null
  gstRatePercent?: number
  timezone: string
}

export async function updateStoreGeneral(tx: StoreTx, storeId: string, patch: StoreGeneralPatch) {
  const [s] = await tx.update(store).set(patch).where(eq(store.id, storeId)).returning()
  return s ?? null
}
