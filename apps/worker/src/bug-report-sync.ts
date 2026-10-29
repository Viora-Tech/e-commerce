import { type BugReportSyncDeps, type GithubClient, pollBugReports } from '@commerce/core'
import type { Db } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import { BUG_REPORT_SYNC_QUEUE, type IORedis, KEEP_FINISHED, Queue, Worker } from '@commerce/queue'

export const BUG_REPORT_SYNC_EVERY_MS = 15 * 60_000

/** Issues read per run: well under GitHub's 5,000 requests an hour (each costs up to four calls). */
const ISSUES_PER_RUN = 40
/** An issue synced this recently (usually by the webhook) is skipped. */
const MIN_AGE_MS = 10 * 60_000

/**
 * "Report a bug" fallback for missed webhooks: every 15 minutes, open reports' GitHub issues are
 * re-read (state, labels, the team's latest public reply, whether the fix reached main) and the
 * changes applied as the webhook would (`pollBugReports`). Only scheduled with GITHUB_ISSUES_TOKEN.
 */
export function createBugReportSync(
  connection: IORedis,
  db: Db,
  deps: BugReportSyncDeps & { github: GithubClient },
) {
  const queue = new Queue(BUG_REPORT_SYNC_QUEUE, { connection })
  const worker = new Worker(
    BUG_REPORT_SYNC_QUEUE,
    async () => {
      const r = await pollBugReports(db, deps, { budget: ISSUES_PER_RUN, minAgeMs: MIN_AGE_MS })
      if (r.updated || r.failed) logger.info('bug reports polled', { area: 'bug-reports', ...r })
      return r
    },
    { connection, concurrency: 1, ...KEEP_FINISHED },
  )
  return { queue, worker }
}
