import { loadEnv } from '@commerce/config'
import {
  checkRateLimit,
  createMemoryRateLimitStore,
  rateLimitKey,
  retryAfterSeconds,
} from '@commerce/core'
import { logger } from '@commerce/observability/logging'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { storeProcedureDetached } from '../procedures'
import {
  appCommit,
  BUG_DETAILS_MAX,
  BUG_ERROR_LENGTH_MAX,
  BUG_ERRORS_MAX,
  BUG_REPORT_RULE,
  BUG_SUMMARY_MAX,
  bugReportStore,
  buildBugIssue,
  decodeScreenshot,
  fileGithubIssue,
  GithubIssueError,
  githubIssueProblem,
  InvalidScreenshot,
  SCREENSHOT_DATA_URL_MAX,
  uploadScreenshot,
} from '../services/bug-report.service'

/** In-process fallback, as in the other routers, for hosts that wire no shared store. */
const fallbackRateLimit = createMemoryRateLimitStore()

const reportInput = z.object({
  summary: z.string().trim().min(1).max(BUG_SUMMARY_MAX),
  details: z.string().max(BUG_DETAILS_MAX).optional(),
  /** The admin page the member was on, path and query. */
  path: z.string().max(1000),
  /** `1440x900`. */
  viewport: z.string().max(40),
  userAgent: z.string().max(600),
  /** The last console errors and unhandled rejections since the page loaded. */
  recentErrors: z.array(z.string().max(BUG_ERROR_LENGTH_MAX)).max(BUG_ERRORS_MAX),
  /** PNG or JPEG data URL, at most 2 MB once decoded. */
  screenshot: z.string().max(SCREENSHOT_DATA_URL_MAX).optional(),
})

/** "Report a bug" (test server only). Developer docs: Operations > Bug reports. */
export const bugReportsRouter = {
  /**
   * Any signed-in member, staff included (no permission): files one GitHub issue with what
   * they typed, the page, the store, who they are and an optional screenshot. Without a token
   * (development only; production refuses to start) the issue is printed to the server log.
   */
  create: storeProcedureDetached.input(reportInput).handler(async ({ context, input }) => {
    const env = loadEnv(process.env)
    if (!env.BUG_REPORTS_ENABLED) {
      throw new ORPCError('FORBIDDEN', { message: 'Bug reports are off on this server.' })
    }
    const { user } = context.session
    const limit = await checkRateLimit(
      context.rateLimit ?? fallbackRateLimit,
      rateLimitKey('bug-report', user.id),
      BUG_REPORT_RULE,
    )
    if (!limit.ok) {
      throw new ORPCError('TOO_MANY_REQUESTS', {
        message: `You have sent a lot of reports. Try again in about ${Math.ceil(retryAfterSeconds(limit) / 60)} minute(s).`,
      })
    }

    let shot: ReturnType<typeof decodeScreenshot> | null = null
    try {
      shot = input.screenshot ? decodeScreenshot(input.screenshot) : null
    } catch (err) {
      if (err instanceof InvalidScreenshot) {
        throw new ORPCError('BAD_REQUEST', { message: err.message })
      }
      throw err
    }

    const { storeId } = context.scope
    const store = await bugReportStore(context.db, storeId, env.SETTINGS_SECRET, shot !== null)
    const screenshotUrl =
      shot && store.storage ? await uploadScreenshot(store.storage, storeId, shot) : null

    const issue = buildBugIssue(input, {
      storeName: store.name,
      storeId,
      reporter: { name: user.name, email: user.email, role: context.scope.roleName },
      commit: appCommit(env),
      at: new Date(),
      screenshotUrl,
    })

    if (!env.GITHUB_ISSUES_TOKEN) {
      console.info(
        `[bug report] No GITHUB_ISSUES_TOKEN, so this was not sent to ${env.GITHUB_ISSUES_REPO}:\n# ${issue.title}\n\n${issue.body}\n`,
      )
      return { number: null, url: null, logged: true }
    }

    try {
      const filed = await fileGithubIssue({
        fetch: context.githubFetch ?? fetch,
        token: env.GITHUB_ISSUES_TOKEN,
        repo: env.GITHUB_ISSUES_REPO,
        issue,
      })
      return { ...filed, logged: false }
    } catch (err) {
      if (err instanceof GithubIssueError) {
        // The status helps whoever reads the server log; the member gets a plain sentence that
        // says what to fix (a bad token never succeeds on retry).
        logger.error('bug report not filed', {
          repo: env.GITHUB_ISSUES_REPO,
          status: err.status,
          error: err,
        })
        throw new ORPCError('BAD_GATEWAY', {
          message: githubIssueProblem(err.status, env.GITHUB_ISSUES_REPO),
        })
      }
      throw err
    }
  }),
}
