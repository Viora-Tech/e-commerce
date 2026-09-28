import { customer, type StoreTx } from '@commerce/db'
import { sql } from 'drizzle-orm'
import { z } from 'zod'
import { setMarketingConsent } from '../privacy/marketing-consent'

const Email = z.string().trim().toLowerCase().email().max(254)

/** Tag the storefront signup adds, so the merchant can segment signups from buyers. */
export const NEWSLETTER_TAG = 'newsletter'

/**
 * The storefront's email signup: the shopper becomes (or stays) a customer who
 * accepted marketing, as Shopify's newsletter form does. An existing customer
 * keeps their details and gains consent and the tag. Returns false for an
 * invalid email.
 */
export async function subscribeToNewsletter(
  tx: StoreTx,
  storeId: string,
  rawEmail: unknown,
): Promise<boolean> {
  const parsed = Email.safeParse(rawEmail)
  if (!parsed.success) return false
  const now = new Date()
  const [row] = await tx
    .insert(customer)
    .values({ storeId, email: parsed.data, tags: [NEWSLETTER_TAG] })
    .onConflictDoUpdate({
      target: [customer.storeId, customer.email],
      set: {
        tags: sql`case when ${NEWSLETTER_TAG} = any(${customer.tags}) then ${customer.tags} else array_append(${customer.tags}, ${NEWSLETTER_TAG}) end`,
        updatedAt: now,
      },
    })
    .returning({ id: customer.id })
  // Consent is recorded with its time and source; signing up again after an
  // unsubscribe is a fresh opt in, so the unsubscribe is cleared.
  if (row) {
    await setMarketingConsent(
      { tx, storeId },
      {
        customerId: row.id,
        channel: 'email',
        granted: true,
        source: 'newsletter',
        actor: { type: 'customer' },
        at: now,
      },
    )
  }
  return true
}
