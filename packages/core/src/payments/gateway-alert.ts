/** SOURCE OF TRUTH: gateway keys owner alert — WHAT: when a payment gateway refuses the store's API keys (`payments.gateway_keys_refused`, written once per incident by `noteGatewayKeysRefused`), the owners are emailed through the store's email channel / WHY: checkout hides the gateway until the keys work again, so the owner must hear at once to re-enter them, without opening the admin */
import { siteConfig } from '@commerce/config/site'
import { type Db, notification, outboxEvent, withStore } from '@commerce/db'
import type { NotificationChannel, NotificationRegistry } from '@commerce/notifications'
import { eq } from 'drizzle-orm'
import { ownerEmails } from '../automations/engine/owner-alerts'
import { escapeHtml } from '../marketing/email'
import { marketingChannels } from '../marketing/send'
import type { OutboxPayload } from '../outbox/types'
import { registriesForStore } from '../plugins/registries'
import { gatewayName } from './gateway-health'

/** The template id the alert is logged under in `notification` (no order, email only). */
const TEMPLATE = 'gateway_keys_refused'

export type GatewayAlertDeps = {
  settingsSecret: string
  /** Admin origin for the link in the email (`ADMIN_URL`). */
  adminUrl: string
  registry?: NotificationRegistry | undefined
  channels?: NotificationChannel[] | undefined
}

/** The email for a gateway that refused the keys. The gateway's words only, never a key. */
function gatewayAlertMessage(
  alert: { gateway: string; error: string },
  adminUrl: string,
): { subject: string; text: string } {
  const name = gatewayName(alert.gateway)
  const link = `${adminUrl.replace(/\/$/, '')}/settings/payments`
  return {
    subject: `${name} rejected your API keys: online payments are off`,
    text: `${name} refused your store's API keys when a shopper tried to pay (${name} said: "${alert.error}"). Until the keys work again, checkout hides ${name} and shoppers can only pay with your other ways to pay, such as UPI to your account, bank transfer or cash on delivery.\n\nCopy the Key ID and Key secret again from your ${name} dashboard, both from the same mode (Test or Live), and save them here: ${link}\n\nCheckout checks the keys again every 10 minutes and shows ${name} again once they work.\n\n${siteConfig.brand.name}`,
  }
}

/**
 * The worker's half for a `payments.gateway_keys_refused` row: email the owners once. Returns
 * false for any other row. A failed send is logged, not retried.
 */
export async function deliverGatewayAlertRow(
  db: Db,
  job: { storeId: string; outboxId: string },
  deps: GatewayAlertDeps,
): Promise<boolean> {
  return withStore(db, job.storeId, async (tx) => {
    const [row] = await tx.select().from(outboxEvent).where(eq(outboxEvent.id, job.outboxId))
    if (row?.type !== 'payments.gateway_keys_refused') return false
    const alert = (row.payload as OutboxPayload).gatewayAlert
    if (!alert) return true
    const registry = deps.registry ?? (await registriesForStore(tx, job.storeId)).notifications
    const { email } = await marketingChannels(tx, job.storeId, {
      registry,
      settingsSecret: deps.settingsSecret,
      storefrontUrl: '',
      channels: deps.channels,
    })
    if (!email?.sendMarketing) return true
    const { subject, text } = gatewayAlertMessage(alert, deps.adminUrl)
    const html = `<div style="white-space:pre-wrap;font-family:sans-serif">${escapeHtml(text)}</div>`
    for (const to of await ownerEmails(tx, job.storeId)) {
      const r = await email.sendMarketing({ kind: 'email', to: { email: to }, subject, html, text })
      await tx.insert(notification).values({
        storeId: job.storeId,
        channel: email.id,
        template: TEMPLATE,
        to,
        status: r.ok ? 'sent' : 'failed',
        providerRef: r.ok ? r.providerRef : null,
        error: r.ok ? null : r.error,
      })
    }
    return true
  })
}
