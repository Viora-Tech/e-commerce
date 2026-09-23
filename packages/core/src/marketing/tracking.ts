import { customer, marketingMessage, type StoreTx } from '@commerce/db'
import { and, eq, isNull, sql } from 'drizzle-orm'

/** First open wins; later opens (and image-proxy prefetches) change nothing. */
export async function recordMessageOpen(tx: StoreTx, messageId: string, at = new Date()) {
  await tx
    .update(marketingMessage)
    .set({ openedAt: at })
    .where(and(eq(marketingMessage.id, messageId), isNull(marketingMessage.openedAt)))
}

/**
 * A click implies an open (images are often blocked). Returns the campaign
 * and automation the message belongs to, so the landing session is credited.
 */
export async function recordMessageClick(
  tx: StoreTx,
  messageId: string,
  at = new Date(),
): Promise<{ campaignId: string | null; automationId: string | null } | null> {
  const [m] = await tx
    .update(marketingMessage)
    .set({
      clickedAt: sql`coalesce(${marketingMessage.clickedAt}, ${at.toISOString()}::timestamptz)`,
      openedAt: sql`coalesce(${marketingMessage.openedAt}, ${at.toISOString()}::timestamptz)`,
    })
    .where(eq(marketingMessage.id, messageId))
    .returning({
      campaignId: marketingMessage.campaignId,
      automationId: marketingMessage.automationId,
    })
  return m ?? null
}

/**
 * Unsubscribe from marketing: email consent off, the time recorded, so no
 * campaign or marketing automation reaches this customer again. Returns the
 * email for the confirmation page, or null for an unknown customer.
 */
export async function unsubscribeCustomer(
  tx: StoreTx,
  customerId: string,
  at = new Date(),
): Promise<{ email: string | null } | null> {
  const [row] = await tx
    .update(customer)
    .set({
      acceptsMarketing: false,
      unsubscribedAt: sql`coalesce(${customer.unsubscribedAt}, ${at.toISOString()}::timestamptz)`,
      updatedAt: at,
    })
    .where(eq(customer.id, customerId))
    .returning({ email: customer.email })
  return row ?? null
}

/** Undo from the confirmation page: consent back on, the unsubscribe cleared. */
export async function resubscribeCustomer(tx: StoreTx, customerId: string, at = new Date()) {
  const [row] = await tx
    .update(customer)
    .set({
      acceptsMarketing: true,
      unsubscribedAt: null,
      marketingConsentAt: at,
      marketingConsentSource: 'unsubscribe_page',
      updatedAt: at,
    })
    .where(eq(customer.id, customerId))
    .returning({ email: customer.email })
  return row ?? null
}

export async function customerSubscription(tx: StoreTx, customerId: string) {
  const [row] = await tx
    .select({
      email: customer.email,
      acceptsMarketing: customer.acceptsMarketing,
      unsubscribedAt: customer.unsubscribedAt,
    })
    .from(customer)
    .where(eq(customer.id, customerId))
  return row ?? null
}
