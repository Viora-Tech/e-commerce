/**
 * The "pay your bill" email (template `plan_bill`), sent through the platform email account to
 * the store's contact email: when a renewal is billed, and once when a plan goes overdue. A new
 * bill the owner just opened from Plan & billing gets no email; they are on the pay page already.
 */
import { type Db, store, withStore } from '@commerce/db'
import { formatMoney } from '@commerce/money'
import { eq } from 'drizzle-orm'
import type { PlatformCodeSender } from '../accounts/deliver-code'
import { getPlatformEmail } from '../sender-email/platform'

export type PlanBillEmail = {
  kind: 'renewal' | 'overdue'
  /** "Growth plan (monthly)", "Reviews app". */
  what: string
  amountPaise: number
  /** When the paid time ends (renewal) or ended (overdue). */
  due: Date
  url: string | null
}

const dayLabel = (d: Date) =>
  new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(d)

/** Never throws: a bill exists either way, and Plan & billing shows it. */
export async function sendPlanBillEmail(
  db: Db,
  storeId: string,
  input: PlanBillEmail,
  platform?: PlatformCodeSender,
): Promise<'sent' | 'skipped' | 'refused'> {
  try {
    if (!input.url) return 'skipped'
    const [s] = await withStore(db, storeId, (tx) =>
      tx
        .select({ name: store.name, email: store.contactEmail })
        .from(store)
        .where(eq(store.id, storeId)),
    )
    if (!s?.email?.includes('@')) return 'skipped'
    const transport = (platform ?? getPlatformEmail()).transport
    if (!transport) return 'skipped'
    const channel = transport.channel({
      fromEmail: transport.fromEmail,
      fromName: transport.fromName,
      replyTo: undefined,
      using: 'platform',
    })
    const r = await channel.send({
      to: { email: s.email },
      template: 'plan_bill',
      data: {
        storeName: s.name,
        customerName: '',
        totalLabel: '',
        lines: [],
        paymentMethodLabel: '',
        actionUrl: input.url,
        planBill: {
          kind: input.kind,
          what: input.what,
          amountLabel: formatMoney(input.amountPaise, 'INR'),
          dueLabel: dayLabel(input.due),
          platformName: transport.fromName,
        },
      },
    })
    return r.ok ? 'sent' : 'refused'
  } catch {
    return 'refused'
  }
}

const PLAN_NAMES = { starter: 'Starter', growth: 'Growth', pro: 'Pro' } as const

export const planBillWhat = (plan: keyof typeof PLAN_NAMES, interval: 'month' | 'year') =>
  `${PLAN_NAMES[plan]} plan (${interval === 'year' ? 'yearly' : 'monthly'})`
