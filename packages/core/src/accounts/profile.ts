import { customer } from '@commerce/db'
import { eq } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { NEWSLETTER_TAG } from '../customers/newsletter'
import { encryptCustomerPhone, phoneBlindIndex } from '../customers/phone-crypto'
import { setMarketingConsents } from '../privacy/marketing-consent'
import { fieldErrors, ProfileInputSchema } from './schemas'

export type ProfileResult = { ok: true } | { ok: false; errors: Record<string, string> }

/**
 * A shopper edits their own name, mobile and marketing consent (per channel,
 * each change kept in the consent history). The email is the sign-in identity
 * and is not editable here, as in Shopify's customer accounts.
 */
export async function updateProfile(
  ctx: StoreContext,
  customerId: string,
  raw: unknown,
  secret: string,
): Promise<ProfileResult> {
  const parsed = ProfileInputSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) }
  const [current] = await ctx.tx
    .select({ tags: customer.tags, phoneIndex: customer.phoneIndex })
    .from(customer)
    .where(eq(customer.id, customerId))
  if (!current) return { ok: false, errors: { form: 'Account not found' } }
  const { name, phone, acceptsMarketing, acceptsWhatsapp, acceptsSms } = parsed.data
  // Opting in from the account page tags the customer like the newsletter form does.
  const tags =
    acceptsMarketing && !current.tags.includes(NEWSLETTER_TAG)
      ? [...current.tags, NEWSLETTER_TAG]
      : current.tags
  const phoneIndex = phone ? phoneBlindIndex(phone, secret) : null
  await ctx.tx
    .update(customer)
    .set({
      name: name || null,
      phone: phone ? encryptCustomerPhone(phone, secret).cipher : phone,
      phoneIndex,
      // A number typed on the profile is not proven; the old proof only covered the old number.
      ...(phoneIndex !== current.phoneIndex ? { phoneVerifiedAt: null } : {}),
      tags,
      updatedAt: new Date(),
    })
    .where(eq(customer.id, customerId))
  await setMarketingConsents(
    ctx,
    customerId,
    { email: acceptsMarketing, whatsapp: acceptsWhatsapp, sms: acceptsSms },
    { source: 'account', actor: { type: 'customer', id: customerId } },
  )
  return { ok: true }
}
