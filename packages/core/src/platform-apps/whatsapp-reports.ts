/** SOURCE OF TRUTH: whatsappStatusReports, whatsappOptOutsOf, applyWhatsappReports, applyWhatsappOptOuts — WHAT: the per-message parts of a verified WhatsApp webhook: Meta's delivery reports (delivered, read, failed) saved on the message they are about, and a shopper's STOP reply turning their WhatsApp consent off / WHY: the message log must show what really happened after Meta accepted a send, and a shopper who replies STOP must stop getting marketing on WhatsApp */
import { customer, marketingMessage, notification, type StoreTx } from '@commerce/db'
import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { phoneBlindIndex } from '../customers/phone-crypto'
import { phoneLookupVariants } from '../marketing/recipient'
import { setMarketingConsent } from '../privacy/marketing-consent'

type Change = { field?: string; value?: Record<string, unknown> }

export type WhatsappReport = {
  /** The WhatsApp message id (`wamid…`), our `provider_ref`. */
  id: string
  status: 'delivered' | 'read' | 'failed'
  at: Date
  error: string | null
}

const REPORTED = new Set(['delivered', 'read', 'failed'])

const list = (v: unknown) =>
  Array.isArray(v) ? (v.filter((x) => x && typeof x === 'object') as Record<string, unknown>[]) : []

/** Seconds since 1970 as Meta sends them ("1732430000"), or now when missing. */
function reportTime(v: unknown, now: Date): Date {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? new Date(n * 1000) : now
}

/** The delivery reports in one `messages` change; `sent` adds nothing to what we know. */
export function whatsappStatusReports(change: Change, now = new Date()): WhatsappReport[] {
  if (change.field !== 'messages') return []
  return list(change.value?.statuses).flatMap((s): WhatsappReport[] => {
    const id = typeof s.id === 'string' ? s.id.slice(0, 200) : ''
    const status = typeof s.status === 'string' ? s.status : ''
    if (!id || !REPORTED.has(status)) return []
    const first = list(s.errors)[0]
    const words = typeof first?.title === 'string' ? first.title : null
    return [
      {
        id,
        status: status as WhatsappReport['status'],
        at: reportTime(s.timestamp, now),
        error:
          status === 'failed' ? (words ?? 'WhatsApp could not deliver it').slice(0, 300) : null,
      },
    ]
  })
}

/**
 * Words that mean "stop messaging me" in a reply, compared without case or punctuation. Not
 * "cancel": a shopper replying CANCEL usually means their order, not their consent.
 */
const OPT_OUT_WORDS = new Set(['stop', 'stop all', 'stopall', 'unsubscribe', 'opt out', 'optout'])

/** True when a reply is only an opt-out word ("STOP", "Unsubscribe.", " stop "). */
export function isOptOutReply(text: string): boolean {
  const words = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return OPT_OUT_WORDS.has(words)
}

/** The phones (digits) that replied with an opt-out word in one `messages` change. */
export function whatsappOptOutsOf(change: Change): string[] {
  if (change.field !== 'messages') return []
  return list(change.value?.messages).flatMap((m) => {
    const from = typeof m.from === 'string' ? m.from.replace(/\D/g, '') : ''
    const text = m.text as { body?: unknown } | undefined
    const body =
      typeof text?.body === 'string'
        ? text.body
        : typeof (m.button as { text?: unknown } | undefined)?.text === 'string'
          ? ((m.button as { text: string }).text as string)
          : ''
    return from && body && isOptOutReply(body) ? [from] : []
  })
}

/** Later reports win, but a late "delivered" never downgrades a "read" (failed always lands). */
const RANK = { delivered: 1, read: 2, failed: 3 } as const

/**
 * Saves each report on the store's message with that WhatsApp id: the order and app messages
 * (`notification`, status `failed` with Meta's words on a failure) and campaign or automation
 * messages (`marketing_message`: a failure, or read as opened). Returns how many rows changed.
 */
export async function applyWhatsappReports(
  tx: StoreTx,
  reports: WhatsappReport[],
): Promise<number> {
  let changed = 0
  for (const r of reports) {
    const lower = Object.entries(RANK)
      .filter(([, rank]) => rank < RANK[r.status])
      .map(([status]) => status)
    const rows = await tx
      .update(notification)
      .set({
        deliveryStatus: r.status,
        deliveryAt: r.at,
        ...(r.status === 'failed' ? { status: 'failed' as const, error: r.error } : {}),
      })
      .where(
        and(
          eq(notification.providerRef, r.id),
          eq(notification.channel, 'whatsapp'),
          r.status === 'failed'
            ? undefined
            : or(
                isNull(notification.deliveryStatus),
                inArray(notification.deliveryStatus, lower as ('delivered' | 'read')[]),
              ),
        ),
      )
      .returning({ id: notification.id })
    changed += rows.length
    if (r.status === 'delivered') continue
    const marketing = await tx
      .update(marketingMessage)
      .set(
        r.status === 'failed'
          ? { status: 'failed', error: r.error }
          : {
              openedAt: sql`coalesce(${marketingMessage.openedAt}, ${r.at.toISOString()}::timestamptz)`,
            },
      )
      .where(and(eq(marketingMessage.providerRef, r.id), eq(marketingMessage.channel, 'whatsapp')))
      .returning({ id: marketingMessage.id })
    changed += marketing.length
  }
  return changed
}

/**
 * A shopper replied STOP: WhatsApp marketing consent goes off for every customer of this store
 * with that phone (recorded in the consent history as their own choice). Returns how many changed.
 */
export async function applyWhatsappOptOuts(
  ctx: StoreContext,
  phones: string[],
  secret: string,
  now = new Date(),
): Promise<number> {
  let changed = 0
  for (const phone of new Set(phones)) {
    const variants = phoneLookupVariants(phone)
    if (variants.length === 0) continue
    const found = await ctx.tx
      .select({ id: customer.id })
      .from(customer)
      .where(
        or(
          inArray(
            customer.phoneIndex,
            variants.map((v) => phoneBlindIndex(v, secret)),
          ),
          inArray(customer.phone, variants),
          inArray(
            customer.phone,
            variants.map((v) => `+${v}`),
          ),
        ),
      )
    for (const c of found) {
      const off = await setMarketingConsent(ctx, {
        customerId: c.id,
        channel: 'whatsapp',
        granted: false,
        source: 'whatsapp_reply',
        actor: { type: 'customer' },
        at: now,
      })
      if (off) changed += 1
    }
  }
  return changed
}
