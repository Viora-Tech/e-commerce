/** SOURCE OF TRUTH: "Send payment link" on a shopper's checkout draft — WHAT: sends the draft's signed pay link (the `draft_invoice` message, linking the order page where the shopper pays or retries) by email, WhatsApp or both, at most once per channel every 10 minutes, and notes it on the draft's timeline / WHY: a checkout draft had only "Copy payment link", so staff could not send it to the shopper from the admin */
import { order, orderNote } from '@commerce/db'
import type { CustomMessage } from '@commerce/notifications'
import { and, eq, gt, like } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { CommerceError } from '../errors'
import { insertOutboxEvent } from '../outbox/write'
import {
  type ReminderChannel,
  reminderChannelFor,
  reminderRequires,
} from '../payments/manual-followup'
import { isOpenCheckoutDraft } from './checkout-draft'

const MINUTE_MS = 60_000
/** Shortest gap between two payment links sent on the same channel for one draft. */
const PAY_LINK_EVERY_MINUTES = 10

/** A single channel the rate limit counts separately. */
export type PayLinkChannel = 'email' | 'whatsapp'

const PREFIX = 'Payment link sent'
const BY: Record<ReminderChannel, string> = {
  email: 'by email',
  whatsapp: 'by WhatsApp',
  both: 'by email and WhatsApp',
}

/** The timeline line: "Payment link sent by email and WhatsApp by priya@shop.in". */
const PAY_LINK_NOTE = (channel: ReminderChannel, author?: string | undefined): string =>
  `${PREFIX} ${BY[channel]}${author ? ` by ${author}` : ''}`

/** The channels a timeline line says a payment link went on (none for any other line). */
function payLinkNoteChannels(body: string): PayLinkChannel[] {
  if (body.startsWith(`${PREFIX} ${BY.both}`)) return ['email', 'whatsapp']
  if (body.startsWith(`${PREFIX} ${BY.email}`)) return ['email']
  if (body.startsWith(`${PREFIX} ${BY.whatsapp}`)) return ['whatsapp']
  return []
}

const channelsOf = (c: ReminderChannel): PayLinkChannel[] =>
  c === 'both' ? ['email', 'whatsapp'] : [c]

export class NotOpenCheckoutDraft extends CommerceError {
  constructor(orderId: string, storeId?: string) {
    super(
      'NOT_OPEN_CHECKOUT_DRAFT',
      `Draft ${orderId} is no longer an unpaid checkout: it was paid, converted or has expired`,
      { storeId },
    )
  }
}

class PayLinkNoRecipient extends CommerceError {
  /** What the merchant asked for. */
  readonly channel: ReminderChannel

  constructor(channel: ReminderChannel, storeId?: string) {
    super(
      'PAY_LINK_NO_RECIPIENT',
      channel === 'whatsapp'
        ? 'WhatsApp is not connected for this store, or the draft has no phone number'
        : channel === 'email'
          ? 'This draft has no email address'
          : 'This draft has no email address or phone number to send to',
      { storeId },
    )
    this.channel = channel
  }
}

export class PayLinkTooSoon extends CommerceError {
  /** The channel that went out too recently (the first one, when both did). */
  readonly channel: PayLinkChannel
  /** When that channel may send again. */
  readonly nextAt: Date

  constructor(channel: PayLinkChannel, nextAt: Date, storeId?: string) {
    super(
      'PAY_LINK_TOO_SOON',
      `The payment link went out ${channel === 'email' ? 'by email' : 'on WhatsApp'} less than ${PAY_LINK_EVERY_MINUTES} minutes ago`,
      { storeId },
    )
    this.channel = channel
    this.nextAt = nextAt
  }
}

/**
 * Staff "Send payment link" on a shopper's open checkout draft: the `draft_invoice` message
 * (delivery points its link at the draft's order page, see `draftInvoiceLink`) by email,
 * WhatsApp (when connected) or both. The draft's row is locked first, so two quick clicks
 * wait for each other and the second hits the 10-minute limit.
 */
export async function sendCheckoutDraftPayLink(
  ctx: StoreContext,
  orderId: string,
  opts: {
    /** The staff member's email, for the timeline. */
    author?: string | undefined
    /** Email, WhatsApp or both (the default: every channel the draft can use). */
    channel?: ReminderChannel | undefined
    custom?: CustomMessage | undefined
    /** The store has a WhatsApp channel connected. */
    whatsapp: boolean
    now?: Date | undefined
  },
): Promise<{ channel: ReminderChannel; sentAt: Date }> {
  const now = opts.now ?? new Date()
  const [d] = await ctx.tx
    .select({
      status: order.status,
      draftSource: order.draftSource,
      draftExpiredAt: order.draftExpiredAt,
      email: order.email,
      phone: order.phone,
    })
    .from(order)
    .where(eq(order.id, orderId))
    .for('update')
  if (!d || !isOpenCheckoutDraft(d)) throw new NotOpenCheckoutDraft(orderId, ctx.storeId)
  const chosen = opts.channel ?? 'both'
  const channel = reminderChannelFor(chosen, d, opts.whatsapp)
  if (!channel) throw new PayLinkNoRecipient(chosen, ctx.storeId)

  const since = new Date(now.getTime() - PAY_LINK_EVERY_MINUTES * MINUTE_MS)
  const recent = await ctx.tx
    .select({ body: orderNote.body, createdAt: orderNote.createdAt })
    .from(orderNote)
    .where(
      and(
        eq(orderNote.orderId, orderId),
        like(orderNote.body, `${PREFIX}%`),
        gt(orderNote.createdAt, since),
      ),
    )
  for (const c of channelsOf(channel)) {
    const last = recent
      .filter((n) => payLinkNoteChannels(n.body).includes(c))
      .reduce<Date | null>((at, n) => (!at || n.createdAt > at ? n.createdAt : at), null)
    if (last) {
      throw new PayLinkTooSoon(
        c,
        new Date(last.getTime() + PAY_LINK_EVERY_MINUTES * MINUTE_MS),
        ctx.storeId,
      )
    }
  }

  await insertOutboxEvent(ctx.tx, ctx.storeId, 'draft.invoice_sent', {
    orderId,
    custom: opts.custom,
    requires: reminderRequires(channel),
  })
  await ctx.tx.insert(orderNote).values({
    storeId: ctx.storeId,
    orderId,
    body: PAY_LINK_NOTE(channel, opts.author),
    author: opts.author ?? 'system',
    createdAt: now,
  })
  return { channel, sentAt: now }
}
