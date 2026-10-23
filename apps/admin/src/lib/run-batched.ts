import { toast } from 'sonner'

/** Calls in flight at once while a bulk action loops single-item endpoints. */
export const BULK_BATCH = 10

export type BatchOutcome = { done: number; failed: number }

/**
 * Bulk work that has no ids[] endpoint: runs `task` for every id, ten at a time, so a large
 * selection neither floods the API nor stops at the first failure. `ok` lets a call that
 * resolved but did nothing (a blocked delete, an email that did not go) count as failed.
 */
export async function runBatched<T>(
  ids: readonly string[],
  task: (id: string) => Promise<T>,
  ok: (result: T) => boolean = () => true,
): Promise<BatchOutcome> {
  let done = 0
  let failed = 0
  for (let i = 0; i < ids.length; i += BULK_BATCH) {
    const results = await Promise.allSettled(ids.slice(i, i + BULK_BATCH).map(task))
    for (const r of results) {
      if (r.status === 'fulfilled' && ok(r.value)) done += 1
      else failed += 1
    }
  }
  return { done, failed }
}

/** The one summary toast after a looped bulk action: success, partial (warning) or failure. */
export function toastOutcome(
  outcome: BatchOutcome,
  summary: (done: number, failed: number) => string,
): void {
  const text = summary(outcome.done, outcome.failed)
  if (outcome.failed === 0) toast.success(text)
  else if (outcome.done === 0) toast.error(text)
  else toast.warning(text)
}
