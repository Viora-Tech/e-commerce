/** SOURCE OF TRUTH: checkStoreSes — WHAT: the store's saved Amazon SES app checked against AWS (keys, sending on, sandbox, From verified, configuration set) / WHY: a wrong key or an unverified From address otherwise only shows up as failed order emails later */
import { type StoreTx, store } from '@commerce/db'
import { checkSesSetup, type SesCheck, sesFactory } from '@commerce/notifications-ses'
import { eq } from 'drizzle-orm'
import { decryptNotificationSettings, parseNotificationSettings } from './settings'

/**
 * The saved SES app's check, or null when the store has no SES app saved. A saved config that is
 * not even valid (a field missing) reads as wrong keys. `check` is for tests.
 */
export async function checkStoreSes(
  tx: StoreTx,
  storeId: string,
  secret: string,
  previousSecrets: string[] = [],
  check: typeof checkSesSetup = checkSesSetup,
): Promise<SesCheck | null> {
  const [s] = await tx
    .select({ notifications: store.notifications })
    .from(store)
    .where(eq(store.id, storeId))
  const settings = decryptNotificationSettings(
    parseNotificationSettings(s?.notifications),
    secret,
    previousSecrets,
  )
  const raw = settings.providers.ses
  if (!raw) return null
  const parsed = sesFactory.validateConfig(raw)
  if (!parsed.ok) return { errors: ['bad_keys'], warnings: [] }
  return check(parsed.config)
}
