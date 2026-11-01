/** SOURCE OF TRUTH: staff replies in Inbox — WHAT: staffSend (a reply, a product, a discount or an order card) and which discounts may be shared / WHY: split out of conversations.ts; the admin API and the AI assist send through it */
import { discount, inboxConversation, media, product } from '@commerce/db'
import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'
import type { StoreContext } from '../context'
import { MESSAGE_MAX, PRODUCTS_PER_CARD_MAX, STAFF_MESSAGE_KINDS } from './constants'
import { loadConversation } from './conversations'
import {
  appendMessage,
  type InboxConversationRow,
  InboxError,
  type InboxMessageRow,
} from './messages'

export const StaffSendSchema = z.object({
  conversationId: z.uuid(),
  kind: z.enum(STAFF_MESSAGE_KINDS).default('text'),
  body: z.string().max(MESSAGE_MAX).default(''),
  /** Product card: up to 3 products. */
  productIds: z.array(z.uuid()).min(1).max(PRODUCTS_PER_CARD_MAX).optional(),
  /** Discount card: an active code. */
  discountId: z.uuid().optional(),
  /** Image: an uploaded media row. */
  mediaId: z.uuid().optional(),
  clientId: z.string().min(8).max(64).optional(),
})
export type StaffSendInput = z.input<typeof StaffSendSchema>

/** A code is shareable while it is on, has a code, and is inside its dates. */
export function isShareableDiscount(
  d: {
    kind: string
    code: string | null
    status: string
    startsAt: Date | null
    endsAt: Date | null
  },
  now: Date = new Date(),
): boolean {
  return (
    d.kind === 'code' &&
    Boolean(d.code) &&
    d.status === 'active' &&
    (!d.startsAt || d.startsAt <= now) &&
    (!d.endsAt || d.endsAt > now)
  )
}

async function cardPayload(
  ctx: StoreContext,
  input: z.output<typeof StaffSendSchema>,
): Promise<Record<string, unknown> | null> {
  const invalid = (message: string) => new InboxError('INBOX_INVALID', message, ctx.storeId)
  if (input.kind === 'product') {
    const ids = [...new Set(input.productIds ?? [])]
    if (ids.length === 0) throw invalid('Pick at least one product')
    const found = await ctx.tx
      .select({ id: product.id })
      .from(product)
      .where(and(inArray(product.id, ids), eq(product.status, 'active')))
    if (found.length !== ids.length) throw invalid('Only active products can be shared')
    return { productIds: ids }
  }
  if (input.kind === 'discount') {
    if (!input.discountId) throw invalid('Pick a discount code')
    const [d] = await ctx.tx.select().from(discount).where(eq(discount.id, input.discountId))
    if (!d || !isShareableDiscount(d)) throw invalid('Only active discount codes can be shared')
    return { discountId: d.id, code: d.code }
  }
  if (input.kind === 'image') {
    if (!input.mediaId) throw invalid('Pick an image')
    const [m] = await ctx.tx
      .select({ id: media.id, url: media.url })
      .from(media)
      .where(eq(media.id, input.mediaId))
    if (!m) throw invalid('Image not found')
    return { mediaId: m.id, url: m.url }
  }
  if (!input.body.trim()) throw invalid('Write a message')
  return null
}

/**
 * A staff reply or note. Replying to a closed conversation opens it again; a blocked one
 * refuses (unblock first). Notes stay staff-only and change no counter the shopper sees.
 */
export async function staffSend(
  ctx: StoreContext,
  raw: StaffSendInput,
  userId: string,
): Promise<{ conversation: InboxConversationRow; message: InboxMessageRow; created: boolean }> {
  const input = StaffSendSchema.parse(raw)
  const conversation = await loadConversation(ctx.tx, ctx.storeId, input.conversationId)
  if (conversation.status === 'blocked' && input.kind !== 'note') {
    throw new InboxError('INBOX_BLOCKED', 'Unblock this conversation to reply', ctx.storeId)
  }
  const payload = await cardPayload(ctx, input)
  const { message, created } = await appendMessage(ctx.tx, ctx.storeId, conversation, {
    sender: 'staff',
    kind: input.kind,
    body: input.body.trim(),
    payload,
    memberUserId: userId,
    clientId: input.clientId ?? null,
  })
  if (created && conversation.status === 'closed' && input.kind !== 'note') {
    await ctx.tx
      .update(inboxConversation)
      .set({ status: 'open', closedAt: null, closedBy: null })
      .where(eq(inboxConversation.id, conversation.id))
  }
  return {
    conversation: await loadConversation(ctx.tx, ctx.storeId, conversation.id),
    message,
    created,
  }
}
