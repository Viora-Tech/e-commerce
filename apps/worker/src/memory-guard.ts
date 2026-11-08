import { readFileSync } from 'node:fs'
import { totalmem } from 'node:os'
import { logger } from '@commerce/observability/logging'

/**
 * SOURCE OF TRUTH KEYWORDS: memory guard, worker memory, pause queues
 * WHAT:  The worker watches its own resident memory against its container limit and backs off
 *        before the kernel has to step in: `slow` pauses bulk queues and halves the rest,
 *        `critical` pauses everything but payments, order emails and the outbox, and a long
 *        stay near the limit ends the process cleanly so Docker restarts it.
 * WHY:   The worker shares a 4 GB box with admin, storefront and Postgres. An OOM kill there can
 *        take any of them down; a paused queue only delays its jobs.
 * WHERE: Started in apps/worker/src/index.ts with every BullMQ worker it runs.
 * Pausing is this process only (`worker.pause(true)`, `worker.resume()`): nothing changes in
 * Redis, waiting jobs stay queued, and running jobs finish.
 */

export type MemoryLevel = 'normal' | 'slow' | 'critical'

/** Shares of the limit (0–1). `exitAfterMs`: how long at or above `exit` before the clean exit. */
export type MemoryThresholds = {
  slow: number
  critical: number
  resume: number
  exit: number
  exitAfterMs: number
}

export const DEFAULT_THRESHOLDS: MemoryThresholds = {
  slow: 0.7,
  critical: 0.85,
  resume: 0.6,
  exit: 0.95,
  exitAfterMs: 60_000,
}

/** How a worker is treated as memory climbs. */
export type QueuePriority = 'critical' | 'normal' | 'bulk'

/**
 * Keep running at `critical`: payments, order emails and what feeds them (the outbox relay),
 * and the heartbeat. Webhooks are HTTP routes, never paused.
 */
const CRITICAL = new Set([
  'heartbeat',
  'notifications',
  'outbox-relay',
  'unpaid-order-expiry',
  'preorder-balance',
  'payment-fees',
])

/** Paused first, at `slow`: imports, images, exports, bulk AI, campaign sends and housekeeping. */
const BULK = new Set([
  'app-jobs',
  'media-process',
  'store-export',
  'theme-screenshot',
  'ai-bulk-write',
  'purchase-documents',
  'marketing-send',
  'back-in-stock',
  'channel-sync',
  'import-snapshot-cleanup',
  'review-summaries',
  'review-requests',
  'home-cards',
  'search-console-sweep',
  'member-daily-summary',
  'affiliate-commissions',
  'api-activity-prune',
  'store-activity-prune',
  'automations-prune',
  'pixels-prune',
  'retention-prune',
  'shopify-token-sweep',
  'fx-rates',
  'bug-report-sync',
])

/** A worker's priority by the label it logs under (`watched` in index.ts). */
export function priorityOf(label: string): QueuePriority {
  if (CRITICAL.has(label)) return 'critical'
  if (BULK.has(label)) return 'bulk'
  return 'normal'
}

/**
 * The level after a reading of `ratio` (resident memory / limit). Up as soon as a threshold is
 * crossed; down only past a lower one, so a reading that hovers does not flap:
 * critical stays until below `slow`, slow stays until below `resume`.
 */
export function nextLevel(
  current: MemoryLevel,
  ratio: number,
  t: MemoryThresholds = DEFAULT_THRESHOLDS,
): MemoryLevel {
  if (ratio >= t.critical) return 'critical'
  if (ratio < t.resume) return 'normal'
  if (current === 'critical') return ratio >= t.slow ? 'critical' : 'slow'
  if (ratio >= t.slow) return 'slow'
  return current
}

/** What one worker should do at a level: paused or not, and its concurrency. */
export function workerPlan(
  level: MemoryLevel,
  priority: QueuePriority,
  baseConcurrency: number,
): { paused: boolean; concurrency: number } {
  if (priority === 'critical' || level === 'normal') {
    return { paused: false, concurrency: baseConcurrency }
  }
  if (level === 'critical' || priority === 'bulk') {
    return { paused: true, concurrency: baseConcurrency }
  }
  return { paused: false, concurrency: Math.max(1, Math.ceil(baseConcurrency / 2)) }
}

/** No limit at all reads as a huge number in cgroup v1 (and "max" in v2). */
const UNLIMITED = 2 ** 50

function readLimitFile(path: string): number | null {
  try {
    const raw = readFileSync(path, 'utf8').trim()
    if (raw === 'max') return null
    const n = Number(raw)
    return Number.isFinite(n) && n > 0 && n < UNLIMITED ? n : null
  } catch {
    return null
  }
}

/**
 * The container's memory limit in bytes: cgroup v2 (`/sys/fs/cgroup/memory.max`), then
 * cgroup v1, then `WORKER_MEMORY_LIMIT_MB`, then the machine's total memory.
 */
export function readMemoryLimit(
  envLimitMb: number | undefined,
  read: (path: string) => number | null = readLimitFile,
): { bytes: number; source: 'cgroup' | 'env' | 'machine' } {
  const cgroup =
    read('/sys/fs/cgroup/memory.max') ?? read('/sys/fs/cgroup/memory/memory.limit_in_bytes')
  if (cgroup) return { bytes: cgroup, source: 'cgroup' }
  if (envLimitMb) return { bytes: envLimitMb * 1024 * 1024, source: 'env' }
  return { bytes: totalmem(), source: 'machine' }
}

/** The part of a BullMQ Worker the guard drives; local to this process. */
export type GuardedWorker = {
  concurrency: number
  pause(doNotWaitActive?: boolean): Promise<void>
  resume(): void
}

type Watched = {
  worker: GuardedWorker
  label: string
  priority: QueuePriority
  base: number
  /** Paused by the guard (the worker's own flag flips only once BullMQ gets to it). */
  paused: boolean
}

export type MemoryGuardOptions = {
  workers: readonly (readonly [GuardedWorker, string])[]
  limitBytes: number
  thresholds?: MemoryThresholds
  /** Resident and heap bytes now. */
  sample?: () => { rss: number; heap: number }
  now?: () => number
  /** Frees what the engine can; Bun's `Bun.gc(true)` where there is one. */
  gc?: () => void
  /** The clean exit: close the workers and leave, so Docker starts a fresh process. */
  exit: () => void
}

const MB = 1024 * 1024

function defaultSample() {
  const m = process.memoryUsage()
  return { rss: m.rss, heap: m.heapUsed }
}

function defaultGc() {
  ;(globalThis as { Bun?: { gc(force: boolean): void } }).Bun?.gc(true)
}

/**
 * The guard: `check()` takes a reading and moves every worker to the level's plan, logging each
 * level change. Call `start()` for a timer (unref'd, so it never keeps the process up).
 */
export function createMemoryGuard(opts: MemoryGuardOptions) {
  const t = opts.thresholds ?? DEFAULT_THRESHOLDS
  const sample = opts.sample ?? defaultSample
  const now = opts.now ?? Date.now
  const gc = opts.gc ?? defaultGc
  const watched: Watched[] = opts.workers.map(([worker, label]) => ({
    worker,
    label,
    priority: priorityOf(label),
    base: worker.concurrency,
    paused: false,
  }))
  let level: MemoryLevel = 'normal'
  let overExitSince: number | null = null
  let exiting = false

  const apply = (to: MemoryLevel) => {
    for (const w of watched) {
      const plan = workerPlan(to, w.priority, w.base)
      if (w.worker.concurrency !== plan.concurrency) w.worker.concurrency = plan.concurrency
      if (plan.paused && !w.paused) {
        w.paused = true
        w.worker.pause(true).catch((err: unknown) => {
          logger.warn('memory guard could not pause a worker', { queue: w.label, error: err })
        })
      } else if (!plan.paused && w.paused) {
        w.paused = false
        w.worker.resume()
      }
    }
  }

  const check = () => {
    if (exiting) return level
    const { rss, heap } = sample()
    const ratio = rss / opts.limitBytes
    const to = nextLevel(level, ratio, t)
    const facts = {
      area: 'memory',
      rssMb: Math.round(rss / MB),
      heapMb: Math.round(heap / MB),
      limitMb: Math.round(opts.limitBytes / MB),
      percent: Math.round(ratio * 100),
    }
    if (to !== level) {
      const from = level
      level = to
      apply(to)
      const paused = watched.filter((w) => w.paused).map((w) => w.label)
      const log = to === 'normal' ? logger.info : logger.warn
      log.call(logger, 'worker memory level changed', { ...facts, from, to, paused })
    }
    if (to === 'critical') gc()

    if (ratio >= t.exit) {
      overExitSince ??= now()
      if (now() - overExitSince >= t.exitAfterMs) {
        exiting = true
        logger.error('worker memory stayed near its limit, restarting cleanly', {
          ...facts,
          seconds: Math.round((now() - overExitSince) / 1000),
        })
        opts.exit()
      }
    } else {
      overExitSince = null
    }
    return level
  }

  let timer: ReturnType<typeof setInterval> | null = null
  return {
    check,
    level: () => level,
    start(everyMs = 5_000) {
      timer ??= setInterval(check, everyMs)
      timer.unref?.()
    },
    stop() {
      if (timer) clearInterval(timer)
      timer = null
    },
  }
}
