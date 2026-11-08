/** The read side of the approval flow: Activity, Approvals and the nav badge. */
import type { StoreContext } from '@commerce/core'
import { aiAction } from '@commerce/db'
import { and, desc, eq, gte, inArray, isNull, lt, ne, or, type SQL } from 'drizzle-orm'
import { canApprove } from '../../../procedures/approval-rules'
import type { StoreScope } from '../../../procedures/store'
import { keyOfRow, onePerRequest } from './duplicates'
import { type ActionView, approvalTtlMs, oneView, permissionOf, type Row, viewsOf } from './views'

/** One action, for "Open approval" (Settings → MCP & API → Activity). Null when it is gone. */
export async function getAction(
  ctx: StoreContext,
  id: string,
  now: Date = new Date(),
): Promise<ActionView | null> {
  const [row] = await ctx.tx.select().from(aiAction).where(eq(aiAction.id, id))
  return row ? oneView(ctx.tx, row, now) : null
}

export type ActivityPage = { items: ActionView[]; hasMore: boolean }

/** Settings → AI → Activity: the store's AI actions, newest first, including ones still waiting for approval. */
export async function listActivity(
  ctx: StoreContext,
  input: { page: number; perPage: number },
  now: Date = new Date(),
): Promise<ActivityPage> {
  await ctx.tx
    .update(aiAction)
    .set({ status: 'expired', updatedAt: now })
    .where(and(eq(aiAction.status, 'proposed'), lt(aiAction.expiresAt, now)))
  const rows = await ctx.tx
    .select()
    .from(aiAction)
    .orderBy(desc(aiAction.createdAt))
    .limit(input.perPage + 1)
    .offset((input.page - 1) * input.perPage)
  return {
    items: await viewsOf(ctx.tx, rows.slice(0, input.perPage), now),
    hasMore: rows.length > input.perPage,
  }
}

/**
 * What Approvals lists for this member: changes sent for a different member's approval, and the
 * member's own AI app (MCP) requests that wait for them to confirm (#1263). Those are not "Needs
 * approval" rows (the owner never has to ask), so without this they showed only in MCP Activity.
 */
const approvalRows = (userId: string): SQL =>
  or(
    eq(aiAction.needsApprover, true),
    and(eq(aiAction.source, 'mcp'), eq(aiAction.userId, userId)),
  ) as SQL

/** An own MCP request the member confirms themselves, rather than one for someone else. */
export const isOwnMcpRequest = (
  v: Pick<ActionView, 'needsApprover' | 'source' | 'requestedById'>,
  userId: string,
): boolean => !v.needsApprover && v.source === 'mcp' && v.requestedById === userId

/**
 * Settings → Approvals: changes waiting for a different member, the member's own MCP requests,
 * and recent expired ones. Copies of the same request (asked before duplicates were folded)
 * show once.
 */
export async function listWaitingApprovals(
  ctx: StoreContext,
  userId: string,
  now: Date = new Date(),
): Promise<ActionView[]> {
  const rows = await ctx.tx
    .select()
    .from(aiAction)
    .where(
      and(
        approvalRows(userId),
        inArray(aiAction.status, ['proposed', 'expired']),
        gte(aiAction.expiresAt, new Date(now.getTime() - approvalTtlMs)),
      ),
    )
    .orderBy(desc(aiAction.createdAt))
    .limit(200)
  return viewsOf(ctx.tx, onePerRequest(rows), now)
}

/**
 * Settings → Approvals → Your requests: what the member sent for approval in the last 30 days
 * and what became of it. Opening it marks the decided ones seen (the nav badge clears).
 */
export async function listMyRequests(
  ctx: StoreContext,
  userId: string,
  now: Date = new Date(),
): Promise<ActionView[]> {
  const rows = await ctx.tx
    .select()
    .from(aiAction)
    .where(
      and(
        eq(aiAction.needsApprover, true),
        eq(aiAction.userId, userId),
        gte(aiAction.createdAt, new Date(now.getTime() - 30 * 24 * 60 * 60_000)),
      ),
    )
    .orderBy(desc(aiAction.createdAt))
    .limit(100)
  await ctx.tx
    .update(aiAction)
    .set({ outcomeSeenAt: now })
    .where(
      and(
        eq(aiAction.needsApprover, true),
        eq(aiAction.userId, userId),
        ne(aiAction.status, 'proposed'),
        isNull(aiAction.outcomeSeenAt),
      ),
    )
  return viewsOf(ctx.tx, rows, now)
}

/**
 * The nav badge: changes this member could approve now, and decisions on their own requests
 * they have not seen yet (how a requester hears the outcome).
 */
export async function approvalCounts(
  ctx: StoreContext,
  scope: StoreScope,
  now: Date = new Date(),
): Promise<{ waiting: number; outcomes: number }> {
  const rows = await ctx.tx
    .select({
      userId: aiAction.userId,
      status: aiAction.status,
      tool: aiAction.tool,
      input: aiAction.input,
      permission: aiAction.permission,
      expiresAt: aiAction.expiresAt,
      outcomeSeenAt: aiAction.outcomeSeenAt,
      needsApprover: aiAction.needsApprover,
    })
    .from(aiAction)
    .where(
      and(
        approvalRows(scope.userId),
        gte(aiAction.createdAt, new Date(now.getTime() - 30 * 24 * 60 * 60_000)),
      ),
    )
  let waiting = 0
  let outcomes = 0
  // Copies of one request count once, as Approvals shows them once.
  const counted = new Set<string>()
  for (const r of rows) {
    const open = r.status === 'proposed' && r.expiresAt.getTime() > now.getTime()
    if (!r.needsApprover) {
      // The member's own MCP request: theirs to confirm, so it counts as waiting for them.
      if (open) waiting++
    } else if (r.userId === scope.userId) {
      if (!open && r.status !== 'proposed' && !r.outcomeSeenAt) outcomes++
    } else if (open && canApprove(scope, permissionOf(r as Row))) {
      const key = keyOfRow(r as Row)
      if (!counted.has(key)) waiting++
      counted.add(key)
    }
  }
  return { waiting, outcomes }
}
