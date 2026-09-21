import type { StoreTx } from '@commerce/db'
import { store } from '@commerce/db'
import { eq } from 'drizzle-orm'

export async function getStore(tx: StoreTx, storeId: string) {
  const [s] = await tx.select().from(store).where(eq(store.id, storeId))
  return s ?? null
}

export async function updateStoreTheme(tx: StoreTx, storeId: string, theme: unknown) {
  const [s] = await tx.update(store).set({ theme }).where(eq(store.id, storeId)).returning()
  return s ?? null
}

export async function updateStorePayments(tx: StoreTx, storeId: string, payments: unknown) {
  const [s] = await tx.update(store).set({ payments }).where(eq(store.id, storeId)).returning()
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
