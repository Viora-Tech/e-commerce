import { QUEUE_LIMITS, type QueueLimits } from '@commerce/queue'

type MediaEnv = {
  MEDIA_PROCESS_CONCURRENCY?: number | undefined
  MEDIA_PROCESS_PER_STORE?: number | undefined
}

/**
 * Worker limits for the image queue: `QUEUE_LIMITS.mediaProcess` unless the env overrides
 * them. The per-store cap is never above the concurrency (a cap above the slots is no cap).
 */
export function mediaProcessLimits(env: MediaEnv): QueueLimits {
  const concurrency = env.MEDIA_PROCESS_CONCURRENCY ?? QUEUE_LIMITS.mediaProcess.concurrency
  const perStore = env.MEDIA_PROCESS_PER_STORE ?? QUEUE_LIMITS.mediaProcess.perStore
  return { concurrency, perStore: Math.min(perStore, concurrency) }
}

/**
 * Cores the image pipeline may use: `MEDIA_CPUS` when set, else every core but one, so a photo
 * upload never takes the whole box from the storefront (#1471). Never below one.
 */
export function mediaCpus(cores: number, configured?: number | undefined): number {
  const budget = configured ?? cores - 1
  return Math.max(1, Math.min(cores, Math.floor(budget)))
}

/** This many of a store's images waiting means a bulk run, whoever queued it (an import, a big upload, an old backlog). */
export const BULK_BACKLOG = 25

/**
 * An import row, or any image queued behind a long backlog of the same store, takes the faster
 * encode; a merchant's own single upload keeps full quality.
 */
export function profileFor(
  job: { bulk?: boolean | undefined },
  storeBacklog = 0,
): 'bulk' | 'interactive' {
  return job.bulk || storeBacklog >= BULK_BACKLOG ? 'bulk' : 'interactive'
}
