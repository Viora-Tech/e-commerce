import { parseNavigationSettings } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { store } from '@commerce/db'
import { eq } from 'drizzle-orm'

export async function getStore(tx: StoreTx, storeId: string) {
  const [s] = await tx.select().from(store).where(eq(store.id, storeId))
  return s ?? null
}

export async function updateStorePreferences(tx: StoreTx, storeId: string, preferences: unknown) {
  const [s] = await tx.update(store).set({ preferences }).where(eq(store.id, storeId)).returning()
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
  gstin: string | null
  gstRatePercent: number
  timezone: string
}

export async function updateStoreGeneral(tx: StoreTx, storeId: string, patch: StoreGeneralPatch) {
  const [s] = await tx.update(store).set(patch).where(eq(store.id, storeId)).returning()
  return s ?? null
}
