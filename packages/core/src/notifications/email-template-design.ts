/** SOURCE OF TRUTH: saved email designs — WHAT: validating, storing and loading a store's own block layout per transactional email, and attaching it to every email a store sends / WHY: one schema for the API and one loader for every send path, so a design never breaks an order email */
import { emailTemplateDesign, type StoreTx } from '@commerce/db'
import {
  checkEmailDesign,
  designableTemplate,
  type EmailTemplateDesign,
  type NotificationChannel,
  parseEmailDesign,
  type TemplateId,
} from '@commerce/notifications'
import { logger } from '@commerce/observability/logging'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

/**
 * What Save accepts: exactly what a send would draw, nothing dropped or changed on the way
 * (`checkEmailDesign` in `@commerce/notifications`: the block types the editor offers, bounded
 * sizes, safe links and images, cleaned HTML, locked built-in blocks never listed as removed).
 * Text is stored as typed and escaped when the email is drawn. A version 1 design from an older
 * editor is accepted and stored as version 2.
 */
export const EmailTemplateDesignSchema = z.unknown().transform((raw, ctx): EmailTemplateDesign => {
  const r = checkEmailDesign(raw)
  if (!r.ok) {
    for (const message of r.issues) ctx.addIssue({ code: 'custom', message })
    return z.NEVER
  }
  return r.design
})

/** The store's saved design for one email, parsed; null for none or a broken row. */
export async function savedTemplateDesign(
  tx: StoreTx,
  storeId: string,
  template: TemplateId,
): Promise<EmailTemplateDesign | null> {
  const [row] = await tx
    .select({ design: emailTemplateDesign.design })
    .from(emailTemplateDesign)
    .where(
      and(eq(emailTemplateDesign.storeId, storeId), eq(emailTemplateDesign.template, template)),
    )
  if (!row) return null
  const parsed = parseEmailDesign(row.design)
  if (!parsed)
    logger.warn('saved email design is not valid; using the built-in email', { template })
  return parsed
}

export async function saveTemplateDesign(
  tx: StoreTx,
  storeId: string,
  template: TemplateId,
  design: EmailTemplateDesign,
  by: string | null,
): Promise<void> {
  await tx
    .insert(emailTemplateDesign)
    .values({ storeId, template, design, updatedBy: by })
    .onConflictDoUpdate({
      target: [emailTemplateDesign.storeId, emailTemplateDesign.template],
      set: { design, updatedBy: by, updatedAt: new Date() },
    })
}

/** Reset to default: the row goes and the built-in email is back. */
export async function resetTemplateDesign(
  tx: StoreTx,
  storeId: string,
  template: TemplateId,
): Promise<void> {
  await tx
    .delete(emailTemplateDesign)
    .where(
      and(eq(emailTemplateDesign.storeId, storeId), eq(emailTemplateDesign.template, template)),
    )
}

/** Templates this store has a saved design for (the Settings list marks them). */
export async function designedTemplates(tx: StoreTx, storeId: string): Promise<string[]> {
  const rows = await tx
    .select({ template: emailTemplateDesign.template })
    .from(emailTemplateDesign)
    .where(eq(emailTemplateDesign.storeId, storeId))
  // The Email branding row (`EMAIL_BRANDING_KEY`) shares the table; it is not an email.
  return rows.map((r) => r.template).filter((t) => !t.startsWith('_'))
}

/**
 * The same channels, with the store's saved design attached to each email they send (loaded
 * once per template). A caller that set `design` itself (the editor's preview) keeps its own.
 * Loading never fails a send: on any error the email goes out with the built-in layout.
 */
export function withEmailDesigns(
  channels: NotificationChannel[],
  load: (template: TemplateId) => Promise<EmailTemplateDesign | null>,
): NotificationChannel[] {
  const cache = new Map<TemplateId, Promise<EmailTemplateDesign | null>>()
  const once = (template: TemplateId) => {
    let p = cache.get(template)
    if (!p) {
      p = load(template).catch((err: unknown) => {
        logger.warn('could not load the saved email design; using the built-in email', {
          template,
          error: err instanceof Error ? err.message : String(err),
        })
        return null
      })
      cache.set(template, p)
    }
    return p
  }
  const send =
    (channel: NotificationChannel): NotificationChannel['send'] =>
    async (message) => {
      if (message.data.design !== undefined || !designableTemplate(message.template)) {
        return channel.send(message)
      }
      const design = await once(message.template)
      return channel.send(design ? { ...message, data: { ...message.data, design } } : message)
    }
  return channels.map((channel) =>
    channel.requires !== 'email'
      ? channel
      : new Proxy(channel, {
          get(target, key, receiver) {
            if (key === 'send') return send(target)
            const value = Reflect.get(target, key, receiver)
            return typeof value === 'function' ? value.bind(target) : value
          },
        }),
  )
}
