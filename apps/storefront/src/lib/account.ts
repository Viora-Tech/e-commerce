import 'server-only'
import { type StoreTx, store } from '@commerce/db'
import { eq } from 'drizzle-orm'

/** The store's own time zone for dates shoppers read. */
export async function storeTimeZone(tx: StoreTx, storeId: string): Promise<string> {
  const [s] = await tx.select({ timezone: store.timezone }).from(store).where(eq(store.id, storeId))
  return s?.timezone ?? 'Asia/Kolkata'
}
