import { createLogger } from 'evlog'

/** The BullMQ job fields a wide event reads; structural, so this package needs no bullmq. */
export type LoggedJob = {
  id?: string | undefined
  name: string
  data?: unknown
  attemptsMade: number
  opts: { attempts?: number | undefined }
  processedOn?: number | undefined
  finishedOn?: number | undefined
  /** Set on jobs a scheduler (`upsertJobScheduler`) made. */
  repeatJobKey?: string | undefined
  returnvalue?: unknown
}

/** The two BullMQ Worker events this file listens to. */
export type JobEventEmitter = {
  on(event: 'completed', listener: (job: LoggedJob) => void): unknown
  on(event: 'failed', listener: (job: LoggedJob | undefined, error: Error) => void): unknown
}

/**
 * Ids from the job payload (`storeId`, `orderId`, `mediaId`…), never anything else in it: the
 * payload can carry customer data.
 */
function payloadIds(data: unknown): Record<string, string> {
  const ids: Record<string, string> = {}
  if (!data || typeof data !== 'object') return ids
  for (const [key, value] of Object.entries(data)) {
    if (/Id$/.test(key) && typeof value === 'string') ids[key] = value
  }
  return ids
}

/** The counts a sweep returns (`{ stores: 3, cancelled: 1 }`); other return values are left out. */
function resultCounts(value: unknown): Record<string, number> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const counts: Record<string, number> = {}
  for (const [key, v] of Object.entries(value)) if (typeof v === 'number') counts[key] = v
  return Object.keys(counts).length ? counts : undefined
}

function emitJob(queue: string, job: LoggedJob | undefined, error?: Error): void {
  const willRetry = !!error && !!job && job.attemptsMade < (job.opts.attempts ?? 1)
  const outcome = !error ? 'completed' : willRetry ? 'retrying' : 'failed'
  const result = error ? undefined : resultCounts(job?.returnvalue)
  const log = createLogger({
    job: {
      queue,
      name: job?.name ?? 'unknown',
      ...(job?.id ? { id: job.id } : {}),
      attempt: job?.attemptsMade ?? 0,
      scheduled: !!job?.repeatJobKey,
    },
    ...payloadIds(job?.data),
    outcome,
    ...(result ? { result } : {}),
  })
  if (error) log.error(error)
  if (willRetry) log.setLevel('warn')
  const ran = job?.processedOn && job.finishedOn ? job.finishedOn - job.processedOn : undefined
  log.emit({
    ...(ran !== undefined ? { _durationMs: ran } : {}),
    // Every real job is kept; only the scheduler's every-few-minutes ticks are sampled.
    ...(job && !job.repeatJobKey ? { _forceKeep: true } : {}),
  })
}

/**
 * SOURCE OF TRUTH KEYWORDS: logWorkerJobs, job wide event, BullMQ logging
 * WHAT:  One wide event per finished BullMQ job attempt: queue, job name and id, payload ids
 *        (storeId…), attempt, duration, outcome (completed / retrying / failed), the error, and
 *        the counts a sweep returns.
 * WHY:   Job logs were scattered console lines without the queue or store; this is the one
 *        searchable record per job. Scheduled ticks that succeed fast are sampled like requests.
 * WHERE: apps/worker/src/index.ts, next to `reportWorkerFailures`; docs/ops/logging.md.
 */
export function logWorkerJobs(worker: JobEventEmitter, queue: string): void {
  worker.on('completed', (job) => emitJob(queue, job))
  worker.on('failed', (job, error) => emitJob(queue, job, error))
}
