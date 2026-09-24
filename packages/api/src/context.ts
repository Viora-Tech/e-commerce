import type { MerchantAuth } from '@commerce/auth'
import type { AppEventQueue, AppJobQueue, NotificationQueue } from '@commerce/core'
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
  /** Live storefront visitors from Dragonfly; absent in tests, the dashboard then shows zeros. */
  visitors?: VisitorSource
  /** Reports an unexpected procedure error (never an intentional ORPCError) to Sentry. No-op in tests. */
  reportError?: ErrorReporter | undefined
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
