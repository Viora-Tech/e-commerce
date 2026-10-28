/** SOURCE OF TRUTH: plan bill emails — WHAT: the `plan_bill` email for renewals and overdue plans / WHY: owners pay before the plan lapses */
/**
 * The "pay your bill" email (template `plan_bill`), sent through the platform email account to
 * the store's contact email: when a renewal is billed, and once when a plan goes overdue. A new
 * bill the owner just opened from Plan & billing gets no email; they are on the pay page already.
 */
import { formatInZone } from '@commerce/dates'
import { type Db, store, withStore } from '@commerce/db'
import { formatMoney } from '@commerce/money'
import { eq } from 'drizzle-orm'
import type { PlatformCodeSender } from '../accounts/deliver-code'
import { getPlatformEmail } from '../sender-email/platform'

export type PlanBillEmail = {
  /** `fair_use`: two months over the plan's visits; nothing is owed (`amountPaise` 0). */
  kind: 'renewal' | 'overdue' | 'usage' | 'fair_use'
  /** "Growth plan (monthly)", "Reviews app". */
  what: string
  amountPaise: number
  /** When the paid time ends (renewal) or ended (overdue). */
  due: Date
  url: string | null
  /** Also send it here (Koomerce support, so a person can reach out). */
  copyTo?: string
}

const dayLabel = (d: Date) => formatInZone(d, { day: 'numeric', month: 'short', year: 'numeric' })

/** Never throws: a bill exists either way, and Plan & billing shows it. */
export async function sendPlanBillEmail(
  db: Db,
  storeId: string,
  input: PlanBillEmail,
  platform?: PlatformCodeSender,
): Promise<'sent' | 'skipped' | 'refused'> {
  try {
    const url = input.url
    if (!url) return 'skipped'
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
    const send = (email: string) =>
      channel.send({
        to: { email },
        template: 'plan_bill',
        data: {
          storeName: s.name,
          customerName: '',
          totalLabel: '',
          lines: [],
          paymentMethodLabel: '',
          actionUrl: url,
          planBill: {
            kind: input.kind,
            what: input.what,
            amountLabel: formatMoney(input.amountPaise, 'INR'),
            dueLabel: dayLabel(input.due),
            platformName: transport.fromName,
          },
        },
      })
    const r = await send(s.email)
    if (input.copyTo) await send(input.copyTo)
    return r.ok ? 'sent' : 'refused'
  } catch {
    return 'refused'
  }
}

const PLAN_NAMES = { starter: 'Starter', growth: 'Growth', pro: 'Pro', scale: 'Scale' } as const

export const planName = (plan: keyof typeof PLAN_NAMES): string => PLAN_NAMES[plan]

export const planBillWhat = (plan: keyof typeof PLAN_NAMES, interval: 'month' | 'year') =>
  `${PLAN_NAMES[plan]} plan (${interval === 'year' ? 'yearly' : 'monthly'})`
