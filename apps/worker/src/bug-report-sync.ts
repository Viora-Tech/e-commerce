import { bugReportSyncDeps, pollBugReports, storeNotificationChannels } from '@commerce/core'
import { registriesForStore } from '@commerce/core/registries'
import type { Db } from '@commerce/db'
import { logger } from '@commerce/observability/logging'

export const BUG_REPORT_SYNC_EVERY_MS = 15 * 60_000

/** Issues read per run: well under GitHub's 5,000 requests an hour (each costs up to four calls). */
const ISSUES_PER_RUN = 40
/** An issue synced this recently (usually by the webhook) is skipped. */
const MIN_AGE_MS = 10 * 60_000

/**
 * "Report a bug" fallback for missed webhooks: every 15 minutes, open reports' GitHub issues are
 * re-read (state, labels, the team's latest public reply, whether the fix reached main) and the
 * changes applied as the webhook would (`pollBugReports`). Null without GITHUB_ISSUES_TOKEN: the
 * webhook alone moves statuses then. The token stays inside the GitHub client, never logged.
 * Runs on the shared sweeps queue (`./sweeps.ts`) like the other scheduled jobs.
 */
export function createBugReportSync(
  db: Db,
  env: {
    GITHUB_ISSUES_TOKEN?: string | undefined
    GITHUB_ISSUES_REPO: string
    GITHUB_CODE_REPO: string
    ADMIN_URL?: string | undefined
    SETTINGS_SECRET: string
  },
) {
  const deps = bugReportSyncDeps({
    token: env.GITHUB_ISSUES_TOKEN,
    repo: env.GITHUB_ISSUES_REPO,
    codeRepo: env.GITHUB_CODE_REPO,
    adminUrl: env.ADMIN_URL,
    // The reporter's WhatsApp goes through the store's own WhatsApp channel.
    storeChannels: async (tx, storeId) =>
      storeNotificationChannels(tx, storeId, {
        registry: (await registriesForStore(tx, storeId)).notifications,
        settingsSecret: env.SETTINGS_SECRET,
      }),
  })
  const github = deps.github
  if (!github) return null
  const run = async () => {
    const r = await pollBugReports(
      db,
      { ...deps, github },
      { budget: ISSUES_PER_RUN, minAgeMs: MIN_AGE_MS },
    )
    if (r.updated || r.failed) logger.info('bug reports polled', { area: 'bug-reports', ...r })
    return r
  }
  return { run }
}
