/** SOURCE OF TRUTH: blockSender, listBlocks, removeBlock, isSenderBlocked — WHAT: Inbox's blocked senders (a browser, an email or an IP, stored as hashes; IP blocks last 30 days) / WHY: staff stop a spammer without seeing or keeping their raw IP (design §7). */
import { inboxBlock, inboxConversation, type StoreTx } from '@commerce/db'
import { and, desc, eq, gt, inArray, isNull, or } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { type BlockedReason, type BlockKind, IP_BLOCK_DAYS } from './constants'
import { InboxError } from './messages'

export type SenderHashes = {
  visitorKeyHash?: string | null
  emailHash?: string | null
  ipHash?: string | null
}

const DAY = 86_400_000

/** Adds (or refreshes) one block. Returns its id. */
export async function blockSender(
  ctx: StoreContext,
  input: {
    kind: BlockKind
    valueHash: string
    reason: BlockedReason
    conversationId?: string | null
    userId?: string | null
  },
  now: Date = new Date(),
): Promise<string> {
  const expiresAt = input.kind === 'ip' ? new Date(now.getTime() + IP_BLOCK_DAYS * DAY) : null
  const [row] = await ctx.tx
    .insert(inboxBlock)
    .values({
      storeId: ctx.storeId,
      kind: input.kind,
      valueHash: input.valueHash,
      reason: input.reason,
      conversationId: input.conversationId ?? null,
      createdBy: input.userId ?? null,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: [inboxBlock.storeId, inboxBlock.kind, inboxBlock.valueHash],
      set: { reason: input.reason, expiresAt, createdBy: input.userId ?? null },
    })
    .returning({ id: inboxBlock.id })
  return row?.id as string
}

/** Live blocks, newest first, with the name on the conversation they came from. */
export async function listBlocks(ctx: StoreContext, now: Date = new Date()) {
  return ctx.tx
    .select({
      id: inboxBlock.id,
      kind: inboxBlock.kind,
      reason: inboxBlock.reason,
      conversationId: inboxBlock.conversationId,
      contactName: inboxConversation.contactName,
      contactEmail: inboxConversation.contactEmail,
      expiresAt: inboxBlock.expiresAt,
      createdAt: inboxBlock.createdAt,
    })
    .from(inboxBlock)
    .leftJoin(inboxConversation, eq(inboxConversation.id, inboxBlock.conversationId))
    .where(or(isNull(inboxBlock.expiresAt), gt(inboxBlock.expiresAt, now)))
    .orderBy(desc(inboxBlock.createdAt))
}

export async function removeBlock(ctx: StoreContext, id: string): Promise<void> {
  const gone = await ctx.tx
    .delete(inboxBlock)
    .where(eq(inboxBlock.id, id))
    .returning({ id: inboxBlock.id })
  if (gone.length === 0) throw new InboxError('INBOX_NOT_FOUND', 'Block not found', ctx.storeId)
}

/** Removes every block made from one conversation (Unblock on the thread). */
export async function removeConversationBlocks(tx: StoreTx, conversationId: string) {
  await tx.delete(inboxBlock).where(eq(inboxBlock.conversationId, conversationId))
}

/** True when any of the sender's hashes is blocked and the block has not expired. */
export async function isSenderBlocked(
  tx: StoreTx,
  who: SenderHashes,
  now: Date = new Date(),
): Promise<boolean> {
  const pairs: { kind: BlockKind; hash: string }[] = []
  if (who.visitorKeyHash) pairs.push({ kind: 'visitor', hash: who.visitorKeyHash })
  if (who.emailHash) pairs.push({ kind: 'email', hash: who.emailHash })
  if (who.ipHash) pairs.push({ kind: 'ip', hash: who.ipHash })
  if (pairs.length === 0) return false
  const rows = await tx
    .select({ kind: inboxBlock.kind, hash: inboxBlock.valueHash })
    .from(inboxBlock)
    .where(
      and(
        inArray(
          inboxBlock.valueHash,
          pairs.map((p) => p.hash),
        ),
        or(isNull(inboxBlock.expiresAt), gt(inboxBlock.expiresAt, now)),
      ),
    )
  return rows.some((r) => pairs.some((p) => p.kind === r.kind && p.hash === r.hash))
}
