import {
  runStoreExport,
  STORE_EXPORT_QUEUE,
  type StoreExportJob,
  storageForStore,
} from '@commerce/core'
import { registriesForStore } from '@commerce/core/registries'
import { type Db, withStore } from '@commerce/db'
import { fairProcessor, type IORedis, QUEUE_LIMITS, Queue, Worker } from '@commerce/queue'

/**
 * Builds a requested full-store export (Settings → General → "Your store's data"): every
 * store table as NDJSON in one zip, put in the store's own storage under
 * `stores/<id>/private/exports/`. One store builds one export at a time
 * (`QUEUE_LIMITS.storeExport`), so a big store's export never holds up a small one's.
 * A failure is written on the export row (the admin shows it) and retried twice.
 */
export function createStoreExportWorker(
  connection: IORedis,
  db: Db,
  opts: { settingsSecret: string },
) {
  const queue = new Queue<StoreExportJob>(STORE_EXPORT_QUEUE, { connection })
  const worker = new Worker<StoreExportJob>(
    STORE_EXPORT_QUEUE,
    fairProcessor(connection, STORE_EXPORT_QUEUE, QUEUE_LIMITS.storeExport, async (job) => {
      const { storeId, exportId } = job.data
      const provider = await withStore(db, storeId, async (tx) =>
        storageForStore(
          tx,
          storeId,
          (await registriesForStore(tx, storeId)).storage,
          opts.settingsSecret,
        ),
      )
      await runStoreExport((fn) => withStore(db, storeId, fn), {
        storeId,
        exportId,
        provider,
        secret: opts.settingsSecret,
      })
      console.log(`[store-export] store=${storeId} export=${exportId} ready`)
    }),
    { connection, concurrency: QUEUE_LIMITS.storeExport.concurrency },
  )
  return { queue, worker }
}
