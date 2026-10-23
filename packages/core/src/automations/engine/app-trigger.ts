/** SOURCE OF TRUTH: plugin automation triggers — WHAT: `fireAppTrigger`, the body of `AppHookContext.triggerAutomation`: writes an `automation.app_trigger` outbox row in the app's own transaction / WHY: plugin triggers then take the normal path (relay → trigger job → runs), idempotent by `app:<pluginId>:<key>` (design §8.9). */
import type { StoreTx } from '@commerce/db'
import type { AppAutomationEvent } from '@commerce/plugins'
import { insertOutboxEvent } from '../../outbox/write'

const TRIGGER_ID = /^[a-z][a-z0-9-]*\/[a-z][a-z0-9_.-]*$/

export async function fireAppTrigger(
  tx: StoreTx,
  storeId: string,
  event: AppAutomationEvent,
): Promise<void> {
  if (!TRIGGER_ID.test(event.trigger)) {
    throw new Error(`automation trigger "${event.trigger}" must be "<pluginId>/<name>"`)
  }
  const key = event.key.trim()
  if (!key || key.length > 200) throw new Error('automation trigger key must be 1-200 characters')
  const data = event.data ?? {}
  if (JSON.stringify(data).length > 16_384) throw new Error('automation trigger data is over 16 KB')
  await insertOutboxEvent(tx, storeId, 'automation.app_trigger', {
    appTrigger: { trigger: event.trigger, key, subject: event.subject, data },
  })
}
