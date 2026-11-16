/** SOURCE OF TRUTH: staff push delivery — WHAT: the worker's half of a push job: works out which members may and want to hear about the event (their role, their own Push switch, approver rules), sends to each of their devices through an injected Web Push sender, and drops devices the push service says are gone / WHY: the sender is injected so this stays testable without a push service, and the database transaction is never held open while a phone's push service answers */
import { authSchema, type Db, type StoreTx, storeMember, withStore } from '@commerce/db'
import { and, eq } from 'drizzle-orm'
import { parseMemberAlertPrefs } from '../member-account/alert-prefs'
import { type MemberAccess, memberAccess } from '../permissions/service'
import { type Permission, permissions } from '../permissions/statement'
import { type PushAudience, type PushMessage, pushMessageForRow, TEST_PUSH } from './messages'
import type { PushJob } from './queue'
import { markPushDevice, type PushDevice, pushDevicesOf } from './subscriptions'

/** What the service worker (`apps/admin/public/push-sw.js`) reads from a push. */
export type PushPayload = {
  title: string
  body: string
  url: string
  tag: string
  storeId: string
}

export type PushSendResult = { ok: true } | { ok: false; gone: boolean; error: string }

/** Sends one payload to one device (the worker wraps `web-push`). */
export type PushSender = (device: PushDevice, payload: string) => Promise<PushSendResult>

export type PushDeliverDeps = {
  send: PushSender
  /** SETTINGS_SECRET: the subscription keys are encrypted with it. */
  settingsSecret: string
  log?: ((message: string, meta?: Record<string, unknown>) => void) | undefined
}

export type PushDeliverResult = { members: number; sent: number; failed: number; gone: number }

/**
 * May approve someone else's change held back by `p`. The same rule as the API's `canApprove`
 * (`packages/api/src/procedures/approval-rules.ts`), restated here because core cannot import
 * the API: the owner, or a member holding approvals.manage and `p` whose own role does not have
 * `p` ticked "Needs approval".
 */
function mayApprove(access: MemberAccess, p: Permission | null): boolean {
  if (access.isOwner) return true
  if (!access.permissions.includes(permissions.APPROVALS_MANAGE)) return false
  return p === null || (access.permissions.includes(p) && !access.needsApproval.includes(p))
}

function inAudience(audience: PushAudience, userId: string, access: MemberAccess): boolean {
  const holds = (p: Permission) => access.isOwner || access.permissions.includes(p)
  switch (audience.kind) {
    case 'role':
      return holds(audience.permission)
    case 'members':
      return (
        audience.userIds.includes(userId) &&
        (audience.permission === null || holds(audience.permission))
      )
    case 'approvers':
      return userId !== audience.askerId && mayApprove(access, audience.permission)
  }
}

/** Active members in the message's audience whose Push switch for its alert is on. */
async function recipients(tx: StoreTx, storeId: string, message: PushMessage): Promise<string[]> {
  const rows = await tx
    .select({ userId: storeMember.userId, prefs: storeMember.notificationPrefs })
    .from(storeMember)
    .innerJoin(authSchema.user, eq(authSchema.user.id, storeMember.userId))
    .where(and(eq(storeMember.storeId, storeId), eq(storeMember.status, 'active')))
  const out: string[] = []
  for (const row of rows) {
    const access = await memberAccess(tx, storeId, row.userId)
    if (!access || !inAudience(message.audience, row.userId, access)) continue
    if (parseMemberAlertPrefs(row.prefs, access.isOwner)[message.alert].push) out.push(row.userId)
  }
  return out
}

/**
 * Runs one push job. An outbox row that is not a push event, or that nobody wants, sends
 * nothing. Throws only when every send failed for a reason other than a gone device, so BullMQ
 * retries a push service outage but never re-sends to devices that already got it on a partial
 * failure.
 */
export async function deliverPushJob(
  db: Db,
  job: PushJob,
  deps: PushDeliverDeps,
): Promise<PushDeliverResult> {
  const plan = await withStore(db, job.storeId, async (tx) => {
    if ('testUserId' in job) {
      const devices = await pushDevicesOf(tx, [job.testUserId], deps.settingsSecret)
      return { payload: { ...TEST_PUSH, storeId: job.storeId }, members: 1, devices }
    }
    const message = await pushMessageForRow(tx, job.outboxId)
    if (!message) return null
    const userIds = await recipients(tx, job.storeId, message)
    const devices = await pushDevicesOf(tx, userIds, deps.settingsSecret)
    const payload: PushPayload = {
      title: message.title,
      body: message.body,
      url: message.url,
      tag: message.tag,
      storeId: job.storeId,
    }
    return { payload, members: userIds.length, devices }
  })
  const result: PushDeliverResult = { members: plan?.members ?? 0, sent: 0, failed: 0, gone: 0 }
  if (!plan || plan.devices.length === 0) return result

  const body = JSON.stringify(plan.payload)
  const outcomes = await Promise.all(
    plan.devices.map(async (device) => ({ device, r: await deps.send(device, body) })),
  )
  const errors: string[] = []
  await withStore(db, job.storeId, async (tx) => {
    for (const { device, r } of outcomes) {
      if (r.ok) {
        result.sent += 1
        await markPushDevice(tx, device.id, 'ok')
      } else if (r.gone) {
        result.gone += 1
        await markPushDevice(tx, device.id, 'gone')
      } else {
        result.failed += 1
        errors.push(r.error)
      }
    }
  })
  if (result.failed > 0) deps.log?.('push send failed', { storeId: job.storeId, errors })
  if (result.sent === 0 && result.failed > 0) throw new Error(`push failed: ${errors[0]}`)
  return result
}
