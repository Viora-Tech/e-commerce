import { DelayedError, type Job } from 'bullmq'
import type IORedis from 'ioredis'

/**
 * Per-store fairness for shared BullMQ queues ("noisy neighbour").
 *
 * Every store's jobs share one queue and one worker pool. Without a cap, a store that
 * queues 5,000 image jobs (a Shopify import) or a 50,000-recipient campaign fills every
 * worker slot and every other store waits behind it. BullMQ's own answer (groups) is
 * BullMQ Pro only, so this is the open-source version of the same idea:
 *
 * - Each queue has a per-store cap (`perStore`) below its worker `concurrency`.
 * - Before a job runs, the worker takes a slot for the job's store in a Redis sorted set
 *   (`fair:<queue>:<storeId>`, one member per running job, scored by lease expiry). The
 *   set is shared by every worker process, so the cap holds across replicas.
 * - A job whose store is already at its cap goes back to the delayed set for a short,
 *   jittered wait (`moveToDelayed` + `DelayedError`; no attempt is used up) and the worker
 *   picks the next job, which is usually another store's. When it comes back it joins the
 *   end of the queue, so busy stores take turns with everyone else (rough round-robin).
 * - Slots are leases: the running job renews its own; a crashed worker's slot lapses after
 *   `leaseMs` instead of blocking that store forever.
 *
 * The check is MULTI/EXEC (trim, add, count, all on one key), not Lua, so it works on
 * Dragonfly without script flags. Two workers racing for the last slot can both see the
 * set over the cap and both back off; it never lets more than `perStore` through.
 */

export type FairnessOptions = {
  /** Most jobs of one store this queue runs at once, across every worker process. */
  perStore: number
  /** How long a slot lives without renewal; the running job renews it every third of this. */
  leaseMs?: number | undefined
  /** Base wait before a deferred job is offered again; a random 0–100% is added on top. */
  retryDelayMs?: number | undefined
}

/** Worker concurrency and per-store cap for each shared queue, in one place. */
export type QueueLimits = { concurrency: number; perStore: number }

const DEFAULT_LEASE_MS = 60_000
const DEFAULT_RETRY_DELAY_MS = 1_500

export const fairnessKey = (queueName: string, storeId: string): string =>
  `fair:${queueName}:${storeId}`

/** The slice of ioredis used here, so tests and other clients can stand in. */
type SlotRedis = Pick<IORedis, 'multi' | 'zadd' | 'zrem' | 'zcard' | 'zremrangebyscore'>

export type StoreSlots = {
  /** Takes a slot for `holder` if the store is under its cap. */
  acquire(storeId: string, holder: string, now?: number): Promise<boolean>
  /** Pushes `holder`'s lease out by another `leaseMs`. */
  renew(storeId: string, holder: string, now?: number): Promise<void>
  release(storeId: string, holder: string): Promise<void>
  /** Live slots for a store right now (expired leases are not counted). */
  active(storeId: string, now?: number): Promise<number>
}

export function storeSlots(
  redis: SlotRedis,
  queueName: string,
  perStore: number,
  leaseMs: number = DEFAULT_LEASE_MS,
): StoreSlots {
  const cap = Math.max(1, Math.floor(perStore))
  return {
    async acquire(storeId, holder, now = Date.now()) {
      const key = fairnessKey(queueName, storeId)
      const results = await redis
        .multi()
        .zremrangebyscore(key, '-inf', now)
        .zadd(key, now + leaseMs, holder)
        .zcard(key)
        .pexpire(key, leaseMs * 2)
        .exec()
      const count = Number(results?.[2]?.[1] ?? 0)
      if (count <= cap) return true
      await redis.zrem(key, holder)
      return false
    },
    async renew(storeId, holder, now = Date.now()) {
      const key = fairnessKey(queueName, storeId)
      // XX: only refresh a slot that still exists; a lapsed one is not silently re-taken.
      await redis.zadd(key, 'XX', now + leaseMs, holder)
    },
    async release(storeId, holder) {
      await redis.zrem(fairnessKey(queueName, storeId), holder)
    },
    async active(storeId, now = Date.now()) {
      const key = fairnessKey(queueName, storeId)
      await redis.zremrangebyscore(key, '-inf', now)
      return redis.zcard(key)
    },
  }
}

type StoreJob = { storeId?: string | undefined }

/**
 * Wraps a BullMQ processor so no store holds more than `perStore` of the queue's worker
 * slots. Jobs without a `storeId` (platform sweeps) run unthrottled.
 *
 *   new Worker(QUEUE, fairProcessor(redis, QUEUE, { perStore: 1 }, async (job) => …), …)
 */
export function fairProcessor<T extends StoreJob, R>(
  redis: SlotRedis,
  queueName: string,
  opts: FairnessOptions,
  processor: (job: Job<T, R>, token?: string) => Promise<R>,
): (job: Job<T, R>, token?: string) => Promise<R> {
  const leaseMs = opts.leaseMs ?? DEFAULT_LEASE_MS
  const retryDelayMs = opts.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS
  const slots = storeSlots(redis, queueName, opts.perStore, leaseMs)

  return async (job, token) => {
    const storeId = job.data?.storeId
    if (!storeId) return processor(job, token)

    // Unique per attempt: a retried job never shares a slot with its own dead attempt.
    const holder = `${job.id ?? 'job'}:${token ?? Math.random().toString(36).slice(2)}`
    if (!(await slots.acquire(storeId, holder))) {
      const wait = retryDelayMs + Math.floor(Math.random() * retryDelayMs)
      await job.moveToDelayed(Date.now() + wait, token)
      throw new DelayedError()
    }

    const renew = setInterval(
      () => {
        slots.renew(storeId, holder).catch(() => undefined)
      },
      Math.max(1_000, Math.floor(leaseMs / 3)),
    )
    try {
      return await processor(job, token)
    } finally {
      clearInterval(renew)
      await slots.release(storeId, holder).catch(() => undefined)
    }
  }
}
