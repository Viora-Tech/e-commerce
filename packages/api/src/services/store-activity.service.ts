import { recordStoreActivity } from '@commerce/core'
import type { StoreTx } from '@commerce/db'

type Entry = Parameters<typeof recordStoreActivity>[2]

/**
 * Write one Settings → Activity log row in a savepoint, so a failed write rolls back only the
 * row and never the change it describes.
 */
export async function recordActivityRow(tx: StoreTx, storeId: string, entry: Entry): Promise<void> {
  await tx.transaction((sp) => recordStoreActivity(sp, storeId, entry))
}
