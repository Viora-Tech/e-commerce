/** SOURCE OF TRUTH: saved email templates — WHAT: a store's reusable designs (list, get, save with a per-store cap) / WHY: one place enforces the cap and the design schema */
import { marketingEmailTemplate, type StoreTx } from '@commerce/db'
import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { CommerceError } from '../errors'
import { type EmailDesign, EmailDesignSchema } from './email-design'

/** Reusable visual-builder designs, per store (RLS scopes every query). */

export const EmailTemplateInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  design: EmailDesignSchema,
})
export type EmailTemplateInput = z.infer<typeof EmailTemplateInputSchema>

/** A store keeps at most this many; the list stays scannable in the builder's menu. */
const MAX_EMAIL_TEMPLATES = 100

export class EmailTemplateLimit extends CommerceError {
  constructor() {
    super(
      'EMAIL_TEMPLATE_LIMIT',
      `A store can keep up to ${MAX_EMAIL_TEMPLATES} email templates. Delete one first.`,
    )
  }
}

export async function listEmailTemplates(tx: StoreTx) {
  return tx
    .select({
      id: marketingEmailTemplate.id,
      name: marketingEmailTemplate.name,
      updatedAt: marketingEmailTemplate.updatedAt,
    })
    .from(marketingEmailTemplate)
    .orderBy(desc(marketingEmailTemplate.updatedAt))
}

export async function getEmailTemplate(tx: StoreTx, id: string) {
  const [row] = await tx
    .select()
    .from(marketingEmailTemplate)
    .where(eq(marketingEmailTemplate.id, id))
  return row ?? null
}

export async function createEmailTemplate(
  tx: StoreTx,
  storeId: string,
  input: { name: string; design: EmailDesign },
) {
  const existing = await listEmailTemplates(tx)
  if (existing.length >= MAX_EMAIL_TEMPLATES) throw new EmailTemplateLimit()
  const [row] = await tx
    .insert(marketingEmailTemplate)
    .values({ storeId, name: input.name, design: input.design })
    .returning({ id: marketingEmailTemplate.id, name: marketingEmailTemplate.name })
  return row ?? null
}

export async function deleteEmailTemplate(tx: StoreTx, id: string): Promise<boolean> {
  const rows = await tx
    .delete(marketingEmailTemplate)
    .where(eq(marketingEmailTemplate.id, id))
    .returning({ id: marketingEmailTemplate.id })
  return rows.length > 0
}

/** Overwrite a saved template's design, its name, or both ("Update template" in the builder). */
export async function updateEmailTemplate(
  tx: StoreTx,
  id: string,
  input: { name?: string | undefined; design?: EmailDesign | undefined },
) {
  const [row] = await tx
    .update(marketingEmailTemplate)
    .set({
      ...(input.name ? { name: input.name } : {}),
      ...(input.design ? { design: input.design } : {}),
      updatedAt: new Date(),
    })
    .where(eq(marketingEmailTemplate.id, id))
    .returning({ id: marketingEmailTemplate.id, name: marketingEmailTemplate.name })
  return row ?? null
}
