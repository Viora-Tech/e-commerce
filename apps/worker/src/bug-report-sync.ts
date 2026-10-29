import { bugReportSyncDeps, pollBugReports } from '@commerce/core'
import type { Db } from '@commerce/db'
import { reportWorkerFailures } from '@commerce/observability'
import { logger, logWorkerJobs } from '@commerce/observability/logging'
import { BUG_REPORT_SYNC_QUEUE, type IORedis, KEEP_FINISHED, Queue, Worker } from '@commerce/queue'
import { reportError } from './observability'

const BUG_REPORT_SYNC_EVERY_MS = 15 * 60_000

/** Issues read per run: well under GitHub's 5,000 requests an hour (each costs up to four calls). */
const ISSUES_PER_RUN = 40
/** An issue synced this recently (usually by the webhook) is skipped. */
const MIN_AGE_MS = 10 * 60_000

/**
 * "Report a bug" fallback for missed webhooks: every 15 minutes, open reports' GitHub issues are
 * re-read (state, labels, the team's latest public reply, whether the fix reached main) and the
 * changes applied as the webhook would (`pollBugReports`). Null without GITHUB_ISSUES_TOKEN: the
 * webhook alone moves statuses then. The token stays inside the GitHub client, never logged.
 * Schedules itself and reports its failures like the other jobs; `close` stops it on shutdown.
 */
export async function createBugReportSync(
  connection: IORedis,
  db: Db,
  env: {
    GITHUB_ISSUES_TOKEN?: string | undefined
    GITHUB_ISSUES_REPO: string
    ADMIN_URL?: string | undefined
  },
) {
  const deps = bugReportSyncDeps({
    token: env.GITHUB_ISSUES_TOKEN,
    repo: env.GITHUB_ISSUES_REPO,
    adminUrl: env.ADMIN_URL,
  })
  const github = deps.github
  if (!github) return null
  const queue = new Queue(BUG_REPORT_SYNC_QUEUE, { connection })
  const worker = new Worker(
    BUG_REPORT_SYNC_QUEUE,
    async () => {
      const r = await pollBugReports(
        db,
        { ...deps, github },
        { budget: ISSUES_PER_RUN, minAgeMs: MIN_AGE_MS },
      )
      if (r.updated || r.failed) logger.info('bug reports polled', { area: 'bug-reports', ...r })
      return r
    },
    { connection, concurrency: 1, ...KEEP_FINISHED },
  )
  reportWorkerFailures(worker, 'bug-report-sync', reportError)
  logWorkerJobs(worker, 'bug-report-sync')
  await queue.upsertJobScheduler(
    'bug-report-sync',
    { every: BUG_REPORT_SYNC_EVERY_MS },
    { name: 'poll' },
  )
  const close = async () => {
    await worker.close()
    await queue.close()
  }
  return { close }
}
