import { dispatchAppJob } from '@commerce/core'
import { type Db, storesWithStaleImportSnapshots } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import {
  SHOPIFY_IMPORT_ID,
  SNAPSHOT_CLEANUP_JOB,
  SNAPSHOT_KEEP_MS,
} from '@commerce/plugin-shopify-import/client'
import { appDeps } from './app-events'

/** Copies only need to go within the day they turn a week old. */
export const SNAPSHOT_CLEANUP_EVERY_MS = 60 * 60 * 1000

/**
 * One repeat job finds every store holding a Shopify import preview copy
 * older than 7 days (an import normally deletes its copy when it finishes)
 * and runs the importer's cleanup job for it, which deletes the files from the
 * store's storage and clears the run row under the store's RLS. One store
 * failing is logged and skipped; the next tick tries again.
 */
export function createImportSnapshotCleanup(db: Db, opts: { settingsSecret: string }) {
  const deps = appDeps(db, opts)
  const run = async () => {
    const cutoff = new Date(Date.now() - SNAPSHOT_KEEP_MS)
    const storeIds = await storesWithStaleImportSnapshots(db, cutoff)
    let cleaned = 0
    for (const storeId of storeIds) {
      try {
        const { ran } = await dispatchAppJob(deps, {
          storeId,
          pluginId: SHOPIFY_IMPORT_ID,
          name: SNAPSHOT_CLEANUP_JOB,
          data: {},
        })
        if (ran) cleaned += 1
      } catch (err) {
        logger.warn('import snapshot cleanup failed', { storeId, error: err })
      }
    }
    return { stores: storeIds.length, cleaned }
  }
  return { run }
}
