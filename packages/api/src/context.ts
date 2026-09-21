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
}
