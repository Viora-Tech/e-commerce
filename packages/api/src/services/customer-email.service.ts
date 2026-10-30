import { deliverEmailTo } from '@commerce/core'
import { customer, customerNote, type StoreTx } from '@commerce/db'
import { ORPCError } from '@orpc/server'
import { eq } from 'drizzle-orm'
import { storeRegistries } from './apps.service'

/**
 * "Email customer" on the customer page: one plain email (the merchant's subject and message)
 * through the store's email channels, logged like every notification so it shows under the
 * customer's messages, and noted on their timeline with who sent it.
 */
export async function emailCustomer(
  tx: StoreTx,
  storeId: string,
  input: {
    customerId: string
    subject: string
    message: string
    author: string
    settingsSecret: string
  },
) {
  const [c] = await tx
    .select({ email: customer.email, name: customer.name })
    .from(customer)
    .where(eq(customer.id, input.customerId))
  if (!c) throw new ORPCError('NOT_FOUND', { message: 'Customer not found' })
  if (!c.email) {
    throw new ORPCError('BAD_REQUEST', { message: 'This customer has no email address' })
  }
  const { notifications } = await storeRegistries(tx, storeId)
  const results = await deliverEmailTo(
    { storeId, tx },
    'customer_message',
    c.email,
    {
      customerName: c.name?.split(' ')[0] ?? '',
      custom: { subject: input.subject, message: input.message },
    },
    { registry: notifications, settingsSecret: input.settingsSecret, requires: 'email' },
  )
  if (results.length === 0) {
    throw new ORPCError('PRECONDITION_FAILED', {
      message: 'Set up an email channel in Settings → Notifications first',
    })
  }
  if (!results.some((r) => r.ok)) {
    throw new ORPCError('BAD_GATEWAY', {
      message: results[0]?.error
        ? `The email was not sent: ${results[0].error}`
        : 'The email was not sent',
    })
  }
  await tx.insert(customerNote).values({
    storeId,
    customerId: input.customerId,
    body: `Emailed: ${input.subject}`,
    author: input.author,
  })
  return { sentTo: c.email }
}
