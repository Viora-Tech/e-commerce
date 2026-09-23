import { customer } from '@commerce/db'
import { eq } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { NEWSLETTER_TAG } from '../customers/newsletter'
import { fieldErrors, ProfileInputSchema } from './schemas'

export type ProfileResult = { ok: true } | { ok: false; errors: Record<string, string> }

/**
 * A shopper edits their own name, mobile and marketing consent. The email is the
 * sign-in identity and is not editable here, as in Shopify's customer accounts.
 */
export async function updateProfile(
  ctx: StoreContext,
  customerId: string,
  raw: unknown,
): Promise<ProfileResult> {
  const parsed = ProfileInputSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) }
  const [current] = await ctx.tx
    .select({ tags: customer.tags })
    .from(customer)
    .where(eq(customer.id, customerId))
  if (!current) return { ok: false, errors: { form: 'Account not found' } }
  const { name, phone, acceptsMarketing } = parsed.data
  // Opting in from the account page tags the customer like the newsletter form does.
  const tags =
    acceptsMarketing && !current.tags.includes(NEWSLETTER_TAG)
      ? [...current.tags, NEWSLETTER_TAG]
      : current.tags
  await ctx.tx
    .update(customer)
    .set({ name: name || null, phone, acceptsMarketing, tags, updatedAt: new Date() })
    .where(eq(customer.id, customerId))
  return { ok: true }
}
