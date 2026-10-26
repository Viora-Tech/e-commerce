import type { MerchantAuth } from '@commerce/auth'
import type {
  AiBulkQueue,
  ApiPrincipal,
  AppEventQueue,
  AppJobQueue,
  ChannelSyncQueue,
  MediaProcessQueue,
  NotificationQueue,
  PlatformCodeSender,
  PurchaseDocumentQueue,
  RateLimitStore,
  StoreExportQueue,
} from '@commerce/core'
import type { AutomationStepQueue } from '@commerce/core/automations/server'
import type { PubSubPublisher } from '@commerce/core/inbox/server'
import type { Db } from '@commerce/db'
import type { ErrorReporter } from '@commerce/observability'
import type { RequestMemo } from './procedures/request-memo'

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
  /** AI reads of uploaded purchase documents, done by the worker. Absent in tests: the read happens in the request. */
  purchaseDocuments?: PurchaseDocumentQueue | undefined
  /** Sales-channel catalog syncs (after Connect, "Sync now"). Absent in tests: nothing is queued. */
  channelSync?: ChannelSyncQueue | undefined
  /** Automations step jobs (Run automation, approvals, retry). Absent in tests: the worker's tick picks the runs up. */
  automationSteps?: AutomationStepQueue | undefined
  /** Live storefront visitors from Dragonfly; absent in tests, the dashboard then shows zeros. */
  visitors?: VisitorSource
  /** Reports an unexpected procedure error (never an intentional ORPCError) to Sentry. No-op in tests. */
  reportError?: ErrorReporter | undefined
  /** Backs per-store rate limits (e.g. the Connect page's "Test connection" button). Falls back to an in-process store when absent, which is fine for tests but not for a multi-instance deployment. */
  rateLimit?: RateLimitStore | undefined
  /** The platform email account for account notices (email changed). Absent: the process's own (`getPlatformEmail`). Tests pass a fake. */
  platformEmail?: PlatformCodeSender | undefined
  /** One request's session and membership answers, shared by every call in it. Absent (tests,
   *  scripts): each call looks them up itself. Never reuse one across requests. */
  memo?: RequestMemo | undefined
  /** Set only by the bearer-token routes (`/api/v1`): the access token's member and what the
   *  token allows. Store procedures then run as that member, capped by the token's areas;
   *  account and other session-only procedures refuse it (`procedures/base.ts`). */
  apiPrincipal?: ApiPrincipal | undefined
  /** Inbox realtime: publishes to Redis pub/sub after a write commits. Absent in tests: nothing is published (clients catch up by replay or polling). */
  inboxPublisher?: PubSubPublisher | undefined
  /** `fetch` for GitHub's issues API ("Report a bug"). Absent: the global fetch. Tests pass a fake so they never reach GitHub. */
  githubFetch?: typeof fetch | undefined
  /** The platform console's connection: the OWNER role, which sees every store. Only the admin's
   *  cookie routes pass it; the bearer-token and MCP routes never do, so `platform.*` answers
   *  "not found" there whatever the caller is. Every query on it is read-only (`platformRead`). */
  platformDb?: Db | undefined
  /** Platform staff emails. Absent: `PLATFORM_ADMIN_EMAILS` from the environment. Tests pass a list. */
  platformStaff?: readonly string[] | undefined
  /** Background job counts per worker queue, for the console's Overview. Absent: not shown. */
  queueHealth?: (() => Promise<QueueHealth[]>) | undefined
}

/** One worker queue's job counts (BullMQ), as the platform console shows them. */
export type QueueHealth = {
  name: string
  waiting: number
  active: number
  delayed: number
  failed: number
  /** When the oldest waiting job was added; null when none waits. */
  oldestWaitingAt: Date | null
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
