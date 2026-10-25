/** SOURCE OF TRUTH: listQuickReplies, createQuickReply, updateQuickReply, deleteQuickReply, reorderQuickReplies — WHAT: Inbox's saved replies, inserted by typing `/shortcut` in the composer / WHY: the same answers (sizes, COD, delivery days) are typed all day (design §6). */
import { inboxQuickReply } from '@commerce/db'
import { asc, eq, max } from 'drizzle-orm'
import { z } from 'zod'
import type { StoreContext } from '../context'
import { MESSAGE_MAX } from './constants'
import { InboxError } from './messages'
import { normaliseShortcut } from './rules'

const Shortcut = z.string().transform((s, c) => {
  const n = normaliseShortcut(s)
  if (!n) {
    c.addIssue({ code: 'custom', message: 'Letters, numbers, - and _ only (up to 32)' })
    return z.NEVER
  }
  return n
})

export const QuickReplyInputSchema = z.object({
  title: z.string().trim().min(1).max(80),
  body: z.string().trim().min(1).max(MESSAGE_MAX),
  shortcut: Shortcut,
})
export const QuickReplyUpdateSchema = QuickReplyInputSchema.extend({ id: z.uuid() })
export type QuickReplyInput = z.infer<typeof QuickReplyInputSchema>

export type QuickReply = {
  id: string
  title: string
  body: string
  shortcut: string
  position: number
}

const columns = {
  id: inboxQuickReply.id,
  title: inboxQuickReply.title,
  body: inboxQuickReply.body,
  shortcut: inboxQuickReply.shortcut,
  position: inboxQuickReply.position,
}

export function listQuickReplies(ctx: StoreContext): Promise<QuickReply[]> {
  return ctx.tx
    .select(columns)
    .from(inboxQuickReply)
    .orderBy(asc(inboxQuickReply.position), asc(inboxQuickReply.title))
}

async function shortcutTaken(ctx: StoreContext, shortcut: string, exceptId?: string) {
  const [row] = await ctx.tx
    .select({ id: inboxQuickReply.id })
    .from(inboxQuickReply)
    .where(eq(inboxQuickReply.shortcut, shortcut))
  return Boolean(row && row.id !== exceptId)
}

const taken = (ctx: StoreContext, shortcut: string) =>
  new InboxError('INBOX_INVALID', `The shortcut /${shortcut} is already used`, ctx.storeId)

export async function createQuickReply(
  ctx: StoreContext,
  raw: z.input<typeof QuickReplyInputSchema>,
  userId: string | null = null,
): Promise<QuickReply> {
  const input = QuickReplyInputSchema.parse(raw)
  if (await shortcutTaken(ctx, input.shortcut)) throw taken(ctx, input.shortcut)
  const [last] = await ctx.tx.select({ n: max(inboxQuickReply.position) }).from(inboxQuickReply)
  const [row] = await ctx.tx
    .insert(inboxQuickReply)
    .values({ storeId: ctx.storeId, ...input, position: (last?.n ?? -1) + 1, createdBy: userId })
    .returning(columns)
  return row as QuickReply
}

export async function updateQuickReply(
  ctx: StoreContext,
  raw: z.input<typeof QuickReplyUpdateSchema>,
): Promise<QuickReply> {
  const input = QuickReplyUpdateSchema.parse(raw)
  if (await shortcutTaken(ctx, input.shortcut, input.id)) throw taken(ctx, input.shortcut)
  const [row] = await ctx.tx
    .update(inboxQuickReply)
    .set({ title: input.title, body: input.body, shortcut: input.shortcut, updatedAt: new Date() })
    .where(eq(inboxQuickReply.id, input.id))
    .returning(columns)
  if (!row) throw new InboxError('INBOX_NOT_FOUND', 'Quick reply not found', ctx.storeId)
  return row
}

export async function deleteQuickReply(ctx: StoreContext, id: string): Promise<void> {
  const gone = await ctx.tx
    .delete(inboxQuickReply)
    .where(eq(inboxQuickReply.id, id))
    .returning({ id: inboxQuickReply.id })
  if (gone.length === 0)
    throw new InboxError('INBOX_NOT_FOUND', 'Quick reply not found', ctx.storeId)
}

/** Puts the replies in the order of `ids` (position 0 first). */
export async function reorderQuickReplies(ctx: StoreContext, ids: string[]): Promise<void> {
  for (const [position, id] of ids.entries()) {
    await ctx.tx.update(inboxQuickReply).set({ position }).where(eq(inboxQuickReply.id, id))
  }
}
