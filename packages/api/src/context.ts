import type { MerchantAuth } from '@commerce/auth'
import type {
  AiBulkQueue,
  AppEventQueue,
  AppJobQueue,
  MediaProcessQueue,
  NotificationQueue,
  RateLimitStore,
  StoreExportQueue,
} from '@commerce/core'
import type { Db } from '@commerce/db'
import type { ErrorReporter } from '@commerce/observability'

/** What the host (admin app) provides per request. */
export type ApiContext = {
  db: Db
  auth: MerchantAuth
  headers: Headers
  /** Order events for the worker. Tests pass an in-memory stub. */
  notifications: NotificationQueue
  /** Lifecycle events for installed apps (refunds); absent in tests that do not need them. */
  appEvents?: AppEventQueue | undefined
  /** Background jobs installed apps queue for themselves (PDF renders, email batches). */
  appJobs?: AppJobQueue | undefined
  /** Upload-time image pipeline job (worker). Absent in tests that do not exercise media confirm; the row is then left `processing` for the backfill script to pick up. */
  mediaProcess?: MediaProcessQueue | undefined
  /** Full store exports, built by the worker. Absent in tests: the export is then built in the request. */
  storeExport?: StoreExportQueue | undefined
  /** Bulk "Write with AI" runs, worked through by the worker. Absent in tests: the run happens in the request. */
  aiBulk?: AiBulkQueue | undefined
  /** Live storefront visitors from Dragonfly; absent in tests, the dashboard then shows zeros. */
  visitors?: VisitorSource
  /** Reports an unexpected procedure error (never an intentional ORPCError) to Sentry. No-op in tests. */
  reportError?: ErrorReporter | undefined
  /** Backs per-store rate limits (e.g. the Connect page's "Test connection" button). Falls back to an in-process store when absent, which is fine for tests but not for a multi-instance deployment. */
  rateLimit?: RateLimitStore | undefined
}

export type LiveVisitors = {
  /** Unique visitors across the last 30 minutes. */
  last30: number
  /** Unique visitors per minute, oldest first, 30 entries. */
  perMinute: number[]
}

export type DailyVisitors = {
  /** Unique visitors per requested day, oldest first. */
  perDay: number[]
  /** Unique visitors across the whole span, de-duplicated. */
  total: number
}

export type VisitorSource = {
  live(storeId: string): Promise<LiveVisitors>
  /** Sessions per IST day for the analytics section; absent in tests, which then read zero. */
  daily?(storeId: string, days: string[]): Promise<DailyVisitors>
}
