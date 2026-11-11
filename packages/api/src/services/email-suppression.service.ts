/** SOURCE OF TRUTH: the admin's view of a store's email suppression list — WHAT: a customer's "Email bounced/complained — not sending" state and "Allow again", and the list under Settings › Notifications › Sender email / WHY: staff need to see why a customer gets no email and undo it once the address works */
import {
  allowEmailAgain,
  type EmailSuppressionRow,
  emailSuppressionFor,
  listEmailSuppressions,
} from '@commerce/core'
import { customer, type StoreTx } from '@commerce/db'
import { eq } from 'drizzle-orm'

export type EmailSuppressionView = {
  email: string
  reason: EmailSuppressionRow['reason']
  detail: string | null
  suppressedAt: string
}

const view = (r: EmailSuppressionRow): EmailSuppressionView => ({
  email: r.email,
  reason: r.reason,
  detail: r.detail,
  suppressedAt: r.suppressedAt.toISOString(),
})

async function customerEmail(tx: StoreTx, customerId: string): Promise<string | null> {
  const [c] = await tx
    .select({ email: customer.email })
    .from(customer)
    .where(eq(customer.id, customerId))
  return c?.email ?? null
}

/** Whether the store stopped emailing this customer, and why; null when it mails them. */
export async function customerEmailSuppression(
  tx: StoreTx,
  customerId: string,
): Promise<EmailSuppressionView | null> {
  const email = await customerEmail(tx, customerId)
  if (!email) return null
  const row = await emailSuppressionFor(tx, email)
  return row ? view(row) : null
}

/** "Allow again" from the customer page. False when the customer's address was not suppressed. */
export async function allowCustomerEmailAgain(
  tx: StoreTx,
  customerId: string,
  by: string,
): Promise<boolean> {
  const email = await customerEmail(tx, customerId)
  return email ? allowEmailAgain(tx, email, by) : false
}

/** The store's active suppressions, newest first. */
export async function emailSuppressionList(tx: StoreTx): Promise<EmailSuppressionView[]> {
  return (await listEmailSuppressions(tx, { limit: 200 })).map(view)
}

/** "Allow again" from the Settings list. */
export async function allowSuppressedEmailAgain(
  tx: StoreTx,
  email: string,
  by: string,
): Promise<boolean> {
  return allowEmailAgain(tx, email, by)
}
