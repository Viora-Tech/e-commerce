/** BullMQ queue the outbox relay posts `inventory.restocked` rows to. Braces keep the key on one Redis slot. */
export const BACK_IN_STOCK_QUEUE = '{back-in-stock}-restock'

export type RestockJob = {
  storeId: string
  variantId: string
  locationId?: string | undefined
}

/** Shape `@commerce/core`'s `InventoryRestockQueue` expects; satisfied by a real BullMQ Queue. */
export type RestockQueueLike = {
  add(
    name: string,
    data: RestockJob,
    opts?: {
      jobId?: string
      attempts?: number
      backoff?: { type: 'exponential' | 'fixed'; delay: number }
    },
  ): Promise<unknown>
}
