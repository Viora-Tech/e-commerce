/** SOURCE OF TRUTH: personalCodeFor — WHAT: a discount code made for one shopper when an automation email goes out / WHY: a retried send finds the code it made the first time */
/**
 * A discount code made for one shopper when an automation email goes out ("Make a unique code
 * for each shopper" on the email's discount block). Shopify's welcome flow sends each new
 * subscriber their own code; ours could only print one code typed by the merchant (audit #182).
 * The code comes from the message id, so a retried send finds the code it made the first time
 * instead of making another.
 */
import { discount, type StoreTx } from '@commerce/db'
import { eq } from 'drizzle-orm'

export type PersonalCodeOffer = {
  /** Whole percent off the order, 1 to 90. */
  percent: number
  /** How long the code works, from the send. */
  days: number
}

/** `WELCOME-7K2QX9FD`: the prefix (letters only) and eight characters from the message id. */
export function personalCodeFor(messageId: string, prefix: string): string {
  const head =
    prefix
      .replace(/[^A-Za-z]/g, '')
      .toUpperCase()
      .slice(0, 12) || 'THANKS'
  const tail = messageId
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(-8)
    .toUpperCase()
  return `${head}-${tail}`
}

/**
 * The shopper's code: single use, only for that customer when there is one, gone after
 * `days`. Returns the code (the existing one on a retry).
 */
export async function issuePersonalCode(
  tx: StoreTx,
  storeId: string,
  input: {
    messageId: string
    prefix: string
    offer: PersonalCodeOffer
    customerId: string | null
    title: string
    now?: Date
  },
): Promise<string> {
  const code = personalCodeFor(input.messageId, input.prefix)
  const [existing] = await tx
    .select({ id: discount.id })
    .from(discount)
    .where(eq(discount.code, code))
  if (existing) return code
  const now = input.now ?? new Date()
  const percent = Math.min(90, Math.max(1, Math.round(input.offer.percent)))
  const days = Math.min(365, Math.max(1, Math.round(input.offer.days)))
  await tx.insert(discount).values({
    storeId,
    title: `${input.title} · ${code}`.slice(0, 120),
    kind: 'code',
    code,
    method: 'percent',
    value: percent * 100,
    usageLimit: 1,
    usagePerCustomer: 1,
    customerEligibility: input.customerId ? 'customers' : 'all',
    eligibleIds: input.customerId ? [input.customerId] : [],
    startsAt: now,
    endsAt: new Date(now.getTime() + days * 86_400_000),
    status: 'active',
  })
  return code
}
