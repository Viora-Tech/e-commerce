/** SOURCE OF TRUTH: Pixels owner alert — WHAT: when Meta stops accepting a pixel's token (`pixel.connection_failed`, written once as the pixel turns to Error), the owners are emailed through the store's email channel / WHY: a dead token silently loses every server event, so the owner must hear without opening the app */
import { siteConfig } from '@commerce/config/site'
import { type Db, notification, outboxEvent, pixelConnection, withStore } from '@commerce/db'
import type { NotificationChannel, NotificationRegistry } from '@commerce/notifications'
import { and, eq } from 'drizzle-orm'
import { ownerEmails } from '../automations/engine/owner-alerts'
import { escapeHtml } from '../marketing/email'
import { marketingChannels } from '../marketing/send'
import type { OutboxPayload } from '../outbox/types'
import { registriesForStore } from '../plugins/registries'

const TEMPLATE = 'pixel_connection_failed'

export type PixelAlertDeps = {
  settingsSecret: string
  /** Admin origin for the link in the email (`ADMIN_URL`). */
  adminUrl: string
  registry?: NotificationRegistry | undefined
  channels?: NotificationChannel[] | undefined
}

/** The email for a pixel whose token Meta refused. No token, no customer data. */
function pixelAlertMessage(
  pixel: { name: string; pixelId: string },
  adminUrl: string,
): { subject: string; text: string } {
  const link = `${adminUrl.replace(/\/$/, '')}/apps/pixels`
  const label = pixel.name ? `${pixel.name} (${pixel.pixelId})` : pixel.pixelId
  return {
    subject: 'Pixels: Meta stopped accepting a pixel token',
    text: `Meta stopped accepting the Conversions API token for ${label}, so server events for it have stopped. The browser pixel still runs.\n\nPaste a new token from Events Manager: ${link}\n\n${siteConfig.brand.name}`,
  }
}

/**
 * The worker's half for a `pixel.connection_failed` row: email the owners once. Returns false
 * for any other row. A failed send is logged, not retried.
 */
export async function deliverPixelAlertRow(
  db: Db,
  job: { storeId: string; outboxId: string },
  deps: PixelAlertDeps,
): Promise<boolean> {
  return withStore(db, job.storeId, async (tx) => {
    const [row] = await tx.select().from(outboxEvent).where(eq(outboxEvent.id, job.outboxId))
    if (row?.type !== 'pixel.connection_failed') return false
    const pixelId = (row.payload as OutboxPayload).externalId ?? ''
    const [p] = await tx
      .select({ name: pixelConnection.name, pixelId: pixelConnection.pixelId })
      .from(pixelConnection)
      .where(and(eq(pixelConnection.storeId, job.storeId), eq(pixelConnection.pixelId, pixelId)))
    const registry = deps.registry ?? (await registriesForStore(tx, job.storeId)).notifications
    const { email } = await marketingChannels(tx, job.storeId, {
      registry,
      settingsSecret: deps.settingsSecret,
      storefrontUrl: '',
      channels: deps.channels,
    })
    if (!email?.sendMarketing) return true
    const { subject, text } = pixelAlertMessage(p ?? { name: '', pixelId }, deps.adminUrl)
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
