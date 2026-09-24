import type { ErrorReporter } from './types'

/** The one BullMQ Worker method this file needs; avoids a bullmq dependency here. */
export type FailureEmitter = {
  on(event: 'failed', listener: (job: JobLike | undefined, error: Error) => void): unknown
}

export type JobLike = {
  name: string
  data?: Record<string, unknown> | undefined
  attemptsMade?: number | undefined
}

/**
 * Reports every failed BullMQ job (after its retries are exhausted or on
 * each attempt, whichever the caller wants) to the app's error reporter,
 * tagged with the queue name and the store id when the job payload carries
 * one — never the job payload itself, which may hold customer data.
 */
export function reportWorkerFailures(
  worker: FailureEmitter,
  queueName: string,
  report: ErrorReporter,
): void {
  worker.on('failed', (job, error) => {
    const storeId = job?.data?.storeId
    report(error, {
      queue: queueName,
      jobName: job?.name ?? 'unknown',
      ...(typeof storeId === 'string' ? { storeId } : {}),
    })
  })
}
