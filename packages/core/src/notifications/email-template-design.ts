/** SOURCE OF TRUTH: saved email designs — WHAT: validating, storing and loading a store's own block layout per transactional email, and attaching it to every email a store sends / WHY: one schema for the API and one loader for every send path, so a design never breaks an order email */
import { emailTemplateDesign, type StoreTx } from '@commerce/db'
import {
  DESIGN_VERSION,
  designableTemplate,
  type EmailTemplateDesign,
  isSafeImage,
  isSafeLink,
  DESIGN_LIMITS as L,
  type NotificationChannel,
  parseEmailDesign,
  SLOT_KEY,
  slotLocked,
  type TemplateId,
} from '@commerce/notifications'
import { logger } from '@commerce/observability/logging'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

const id = z
  .string()
  .min(1)
  .max(L.id)
  .regex(/^[A-Za-z0-9_#-]+$/)
const words = (max: number) => z.string().max(max)
const link = z
  .string()
  .trim()
  .min(1)
  .max(L.url)
  .refine(isSafeLink, 'Links must start with https://, http:// or mailto:')
const slot = z.string().regex(SLOT_KEY)

const BlockSchema = z.discriminatedUnion('type', [
  z.object({
    id,
    type: z.literal('intro'),
    eyebrow: words(L.label).optional(),
    heading: words(L.label).optional(),
    lead: words(L.text).optional(),
  }),
  z.object({ id, type: z.literal('slot'), slot }),
  z.object({ id, type: z.literal('logo'), menu: z.boolean() }),
  z.object({
    id,
    type: z.literal('heading'),
    text: words(L.label),
    size: z.enum(['large', 'small']),
  }),
  z.object({
    id,
    type: z.literal('text'),
    text: words(L.text),
    align: z.enum(['left', 'center']),
    muted: z.boolean(),
  }),
  z.object({
    id,
    type: z.literal('image'),
    src: z
      .string()
      .trim()
      .max(L.url)
      .refine(isSafeImage, 'Images must be https or from your media library'),
    alt: words(L.label),
    href: link.optional(),
    width: z.number().int().min(20).max(100),
  }),
  z.object({ id, type: z.literal('button'), label: words(L.label).min(1), url: link }),
  z.object({ id, type: z.literal('divider'), label: words(L.label) }),
  z.object({ id, type: z.literal('spacer'), size: z.enum(['small', 'medium', 'large']) }),
  z.object({ id, type: z.literal('social') }),
  z.object({ id, type: z.literal('help') }),
  z.object({ id, type: z.literal('footer'), social: z.boolean() }),
])

/**
 * What Save accepts: the block types the editor offers, bounded sizes, safe links and images.
 * Text is stored as typed and escaped when the email is drawn, so HTML in it shows as text.
 * Locked built-in blocks may not be listed as removed.
 */
export const EmailTemplateDesignSchema = z
  .object({
    version: z.literal(DESIGN_VERSION),
    subject: words(L.subject).optional(),
    blocks: z.array(BlockSchema).max(L.blocks),
    removed: z.array(slot).max(L.blocks).default([]),
  })
  .superRefine((d, ctx) => {
    const ids = new Set<string>()
    for (const b of d.blocks) {
      if (ids.has(b.id)) ctx.addIssue({ code: 'custom', message: `Duplicate block id ${b.id}` })
      ids.add(b.id)
    }
    if (d.blocks.filter((b) => b.type === 'intro').length > 1) {
      ctx.addIssue({ code: 'custom', message: 'Only one intro block' })
    }
    for (const key of d.removed) {
      if (slotLocked(key)) ctx.addIssue({ code: 'custom', message: `${key} cannot be removed` })
    }
    if (JSON.stringify(d).length > L.bytes) {
      ctx.addIssue({ code: 'custom', message: 'The design is too large' })
    }
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
