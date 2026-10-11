import { PURCHASE_DOCUMENT_QUEUE, type PurchaseDocumentJob } from '@commerce/core'
import { readPurchaseDocument } from '@commerce/core/ai-runtime'
import type { Db } from '@commerce/db'
import { fairProcessor, type IORedis, QUEUE_LIMITS, Queue, Worker } from '@commerce/queue'

/**
 * "Upload bills and let us read them" (purchase order and inbound shipment pages): one
 * job per uploaded document. The reader admits and meters one AI call against the store's
 * plan, reads the PDF text (or sends the scan itself) and stores the result for the merchant
 * to review; nothing reaches the order until they press Apply. Fair per store
 * (`QUEUE_LIMITS.purchaseDocuments`). A failed read is recorded on the document, not retried.
 */
export function createPurchaseDocumentWorker(connection: IORedis, db: Db) {
  const queue = new Queue<PurchaseDocumentJob>(PURCHASE_DOCUMENT_QUEUE, { connection })
  const worker = new Worker<PurchaseDocumentJob>(
    PURCHASE_DOCUMENT_QUEUE,
    fairProcessor(
      connection,
      PURCHASE_DOCUMENT_QUEUE,
      QUEUE_LIMITS.purchaseDocuments,
      async (job) => {
        const { storeId, documentId } = job.data
        await readPurchaseDocument({ db, storeId, documentId })
        console.log(`[purchase-documents] store=${storeId} document=${documentId} read`)
      },
    ),
    // A long scanned Bill of Entry can take a minute or two to read.
    { connection, concurrency: QUEUE_LIMITS.purchaseDocuments.concurrency, lockDuration: 180_000 },
  )
  return { queue, worker }
}
