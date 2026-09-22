import type { MerchantAuth } from '@commerce/auth'
import type { NotificationQueue } from '@commerce/core'
import type { Db } from '@commerce/db'

/** What the host (admin app) provides per request. */
export type ApiContext = {
  db: Db
  auth: MerchantAuth
  headers: Headers
  /** Order events for the worker. Tests pass an in-memory stub. */
  notifications: NotificationQueue
  /** Live storefront visitors from Dragonfly; absent in tests, the dashboard then shows zeros. */
  visitors?: VisitorSource
}

export type LiveVisitors = {
  /** Unique visitors across the last 30 minutes. */
  last30: number
  /** Unique visitors per minute, oldest first, 30 entries. */
  perMinute: number[]
}

export type VisitorSource = {
  live(storeId: string): Promise<LiveVisitors>
}
