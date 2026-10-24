/** SOURCE OF TRUTH: Automations owner alerts — WHAT: the owner hears when the store used 80% and 100% of its monthly automation runs (once each per month, `automation_usage.warned_at_*`) and when the circuit breaker switches a workflow off; the moment is written as an `automation.owner_alert` outbox row in the same transaction, and the worker's trigger job emails the store's owners (else its contact address) through the store's email channel / WHY: a store that hits its plan limit or loses a workflow to a loop must find out without opening the app (design §8.5). */
import { siteConfig } from '@commerce/config/site'
import {
  authSchema,
  automationUsage,
  automationWorkflow,
  type Db,
  notification,
  outboxEvent,
  role,
  type StoreTx,
  store,
  storeMember,
  withStore,
} from '@commerce/db'
import type { NotificationChannel, NotificationRegistry } from '@commerce/notifications'
import { and, eq, isNull } from 'drizzle-orm'
import { escapeHtml } from '../../marketing/email'
import { marketingChannels } from '../../marketing/send'
import type { OutboxPayload } from '../../outbox/types'
import { insertOutboxEvent } from '../../outbox/write'
import { registriesForStore } from '../../plugins/registries'

export type OwnerAlert = NonNullable<OutboxPayload['ownerAlert']>

/** The template id alerts are logged under in `notification` (no order, email only). */
const OWNER_ALERT_TEMPLATE = 'automation_owner_alert'

/**
 * Records an 80% or 100% crossing for this month, once: the `warned_at_*` stamp is claimed
 * with `where … is null`, so two trigger jobs racing past the line write one alert.
 */
export async function noteUsageAlert(
  tx: StoreTx,
  storeId: string,
  month: string,
  level: 80 | 100,
  usage: { runs: number; limit: number },
): Promise<boolean> {
  const column = level === 80 ? automationUsage.warnedAt80 : automationUsage.warnedAt100
  const set = level === 80 ? { warnedAt80: new Date() } : { warnedAt100: new Date() }
  const claimed = await tx
    .update(automationUsage)
    .set(set)
    .where(
      and(eq(automationUsage.storeId, storeId), eq(automationUsage.month, month), isNull(column)),
    )
    .returning({ storeId: automationUsage.storeId })
  if (claimed.length === 0) return false
  await insertOutboxEvent(tx, storeId, 'automation.owner_alert', {
    ownerAlert: { kind: level === 80 ? 'usage_80' : 'usage_100', ...usage },
  })
  return true
}

/** The circuit breaker switched a workflow off: tell the owner why. */
export async function noteSwitchedOff(
  tx: StoreTx,
  storeId: string,
  workflowId: string,
  problem: string,
): Promise<void> {
  await insertOutboxEvent(tx, storeId, 'automation.owner_alert', {
    ownerAlert: { kind: 'switched_off', workflowId, problem },
  })
}

/** Active owners' sign-in emails; the store's contact address when there is none. Pixels alerts use it too. */
export async function ownerEmails(tx: StoreTx, storeId: string): Promise<string[]> {
  const rows = await tx
    .select({ email: authSchema.user.email })
    .from(storeMember)
    .innerJoin(role, eq(role.id, storeMember.roleId))
    .innerJoin(authSchema.user, eq(authSchema.user.id, storeMember.userId))
    .where(
      and(
        eq(storeMember.storeId, storeId),
        eq(storeMember.status, 'active'),
        eq(role.slug, 'owner'),
      ),
    )
  const emails = [...new Set(rows.map((r) => r.email).filter(Boolean))]
  if (emails.length) return emails
  const [s] = await tx
    .select({ email: store.contactEmail })
    .from(store)
    .where(eq(store.id, storeId))
  return s?.email ? [s.email] : []
}

/** Subject and plain text for one alert. */
async function alertMessage(
  tx: StoreTx,
  alert: OwnerAlert,
  adminUrl: string,
): Promise<{ subject: string; text: string }> {
  const app = `${adminUrl.replace(/\/$/, '')}/apps/automations`
  const brand = siteConfig.brand.name
  if (alert.kind === 'switched_off') {
    const [w] = alert.workflowId
      ? await tx
          .select({ name: automationWorkflow.name })
          .from(automationWorkflow)
          .where(eq(automationWorkflow.id, alert.workflowId))
      : []
    const name = w?.name ?? 'A workflow'
    return {
      subject: `Automations: "${name}" was switched off`,
      text: `${alert.problem ?? 'It was switched off automatically.'}\n\nCheck its runs and switch it back on when it is fixed: ${app}\n\n${brand}`,
    }
  }
  const used = `${alert.runs ?? 0} of ${alert.limit ?? 0} automation runs`
  if (alert.kind === 'usage_80') {
    return {
      subject: 'Automations: 80% of this month’s runs used',
      text: `Your store has used ${used} this month. At the limit new runs are skipped until next month, so upgrade your plan if you need more: ${app}\n\n${brand}`,
    }
  }
  return {
    subject: 'Automations: this month’s run limit reached',
    text: `Your store has used ${used} this month. New runs are skipped until next month (Growth marketing automations keep running). Upgrade your plan to run more: ${app}\n\n${brand}`,
  }
}

export type OwnerAlertDeps = {
  settingsSecret: string
  /** Admin origin for the link in the email (`ADMIN_URL`). */
  adminUrl: string
  /** Tests inject these. */
  registry?: NotificationRegistry | undefined
  channels?: NotificationChannel[] | undefined
}

/**
 * The worker's half: if the outbox row is an owner alert, email it to the owners through the
 * store's email channel and log each send. Returns false for any other row (the caller then
 * runs it as a trigger). A failed send is logged, not retried: an alert is not worth a resend storm.
 */
export async function deliverOwnerAlertRow(
  db: Db,
  job: { storeId: string; outboxId: string },
  deps: OwnerAlertDeps,
): Promise<boolean> {
  return withStore(db, job.storeId, async (tx) => {
    const [row] = await tx.select().from(outboxEvent).where(eq(outboxEvent.id, job.outboxId))
    if (row?.type !== 'automation.owner_alert') return false
    const alert = (row.payload as OutboxPayload).ownerAlert
    if (!alert) return true
    const registry = deps.registry ?? (await registriesForStore(tx, job.storeId)).notifications
    const { email } = await marketingChannels(tx, job.storeId, {
      registry,
      settingsSecret: deps.settingsSecret,
      storefrontUrl: '',
      channels: deps.channels,
    })
    if (!email?.sendMarketing) return true
    const { subject, text } = await alertMessage(tx, alert, deps.adminUrl)
    const html = `<div style="white-space:pre-wrap;font-family:sans-serif">${escapeHtml(text)}</div>`
    for (const to of await ownerEmails(tx, job.storeId)) {
      const r = await email.sendMarketing({ kind: 'email', to: { email: to }, subject, html, text })
      await tx.insert(notification).values({
        storeId: job.storeId,
        channel: email.id,
        template: OWNER_ALERT_TEMPLATE,
        to,
        status: r.ok ? 'sent' : 'failed',
        providerRef: r.ok ? r.providerRef : null,
        error: r.ok ? null : r.error,
      })
    }
    return true
  })
}
