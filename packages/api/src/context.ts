import type { MerchantAuth } from '@commerce/auth'
import type { Db } from '@commerce/db'

/** What the host (admin app) provides per request. */
export type ApiContext = {
  db: Db
  auth: MerchantAuth
  headers: Headers
}
