/**
 * The approval flow for assistant actions, over the `ai_action` log:
 *
 *   model calls a propose tool → `proposeAction` validates and stores it as `proposed`
 *   merchant clicks Edit       → `reviseAction` re-runs the proposal with their changes
 *   merchant clicks Approve    → `approveAction` checks they may decide it (`openFor`), that it
 *                                is still open, and that their role holds the action's
 *                                permission, then runs it as them in a savepoint inside their
 *                                RLS transaction
 *   merchant clicks Cancel     → `cancelAction`
 *   Activity → Undo            → `undoAction` (same permission check)
 *
 * Who decides: the assistant's own proposals belong to the member who asked in the AI bar. A
 * change an MCP client proposed may be decided by the member who connected it, the store owner,
 * or any member whose role holds the action's permission; it always runs as the approver.
 *
 * Role approvals: when the deciding member's role ticks "Needs approval" for the action's
 * permission, Approve does not run it but hands it to Approvals (`needsApprover`). A change a
 * member makes in the admin or through the API with such a tick lands there directly
 * (`queueForApprover`, from the store procedure). From then on only a different member who may
 * approve it (`canApprove`) can approve it; the asker can only withdraw it.
 *
 * Nothing here is reachable by the model: it only ever creates `proposed` rows.
 */
import { ASSISTANT_LIMITS } from '@commerce/ai'
import type { StoreContext } from '@commerce/core'
import { isPermission, type Permission } from '@commerce/core/permissions'
import {
  type AiActionSource,
  type AiActionStatus,
  aiAction,
  authSchema,
  type StoreTx,
} from '@commerce/db'
import { ORPCError } from '@orpc/server'
import { and, desc, eq, gte, inArray, isNull, lt, ne } from 'drizzle-orm'
import { canApprove, mustAsk } from '../../../procedures/approval-rules'
import type { StoreScope } from '../../../procedures/store'
import { adminAction, queuedAdminAction } from './actions/admin-action'
import { ApproverNotAllowed, NeedsApprover, ProposalProblem } from './actions/resolve'
import type { ActionEnv, ActionPreview, EditField } from './actions/types'
import { actionFor, undoerFor } from './registry'

type Stored = {
  raw: Record<string, unknown>
  resolved: unknown
}

type Outcome = {
  message?: string
  href?: string | null
  by?: string
  /** The member confirmed their own AI client's change (MCP): confirming the AI, not approving
   *  someone else's request. */
  confirmedAi?: boolean
  undoMessage?: string
  undoneByEmail?: string
}

export type ActionView = {
  id: string
  tool: string
  source: AiActionSource
  status: AiActionStatus
  summary: string
  preview: ActionPreview
  editable: EditField[]
  flagged: boolean
  error: string | null
  message: string | null
  href: string | null
  canUndo: boolean
  /** Who approved or cancelled it (email), once someone did. */
  by: string | null
  /** The asker confirmed their own AI client's change (MCP), rather than someone approving it. */
  confirmedAi: boolean
  /** The member who asked for it: in the AI bar, or by connecting the MCP client. */
  requestedBy: string | null
  requestedById: string
  /** Waits in Approvals for a different member (the asker's role ticks "Needs approval"). */
  needsApprover: boolean
  /** The permission it needs, when known. */
  permission: string | null
  createdAt: Date
  expiresAt: Date
  executedAt: Date | null
  undoneAt: Date | null
  undoMessage: string | null
}

type Row = typeof aiAction.$inferSelect

/** A proposal past its expiry reads as expired even before a list marks it so. */
const statusAt = (row: Row, now: Date): AiActionStatus =>
  row.status === 'proposed' && row.expiresAt.getTime() <= now.getTime() ? 'expired' : row.status

function viewOf(row: Row, requestedBy: string | null, now: Date): ActionView {
  const stored = row.input as Partial<Stored>
  const outcome = (row.result ?? {}) as Outcome
  const definition = actionFor(row.tool)
  const status = statusAt(row, now)
  const editable =
    status === 'proposed' && definition && stored.raw
      ? definition.editFields(stored.raw as never)
      : []
  return {
    id: row.id,
    tool: row.tool,
    source: row.source,
    status,
    summary: row.summary,
    preview: row.preview as ActionPreview,
    editable,
    flagged: row.flagged,
    error: row.error,
    message: outcome.message ?? null,
    href: outcome.href ?? null,
    canUndo: row.status === 'executed' && row.undo !== null,
    by: outcome.by ?? null,
    confirmedAi: outcome.confirmedAi === true,
    requestedBy,
    requestedById: row.userId,
    needsApprover: row.needsApprover,
    permission: row.permission,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    executedAt: row.executedAt,
    undoneAt: row.undoneAt,
    undoMessage: outcome.undoMessage ?? null,
  }
}

/** Members' names by id, for "asked by" on the cards and in Activity. */
async function namesOf(tx: StoreTx, userIds: string[]): Promise<Map<string, string>> {
  if (!userIds.length) return new Map()
  const rows = await tx
    .select({ id: authSchema.user.id, name: authSchema.user.name, email: authSchema.user.email })
    .from(authSchema.user)
    .where(inArray(authSchema.user.id, [...new Set(userIds)]))
  return new Map(rows.map((r) => [r.id, r.name?.trim() || r.email]))
}

async function viewsOf(tx: StoreTx, rows: Row[], now: Date): Promise<ActionView[]> {
  const names = await namesOf(
    tx,
    rows.map((r) => r.userId),
  )
  return rows.map((r) => viewOf(r, names.get(r.userId) ?? null, now))
}

async function oneView(tx: StoreTx, row: Row, now: Date): Promise<ActionView> {
  const [view] = await viewsOf(tx, [row], now)
  return view as ActionView
}

const ttlMs = ASSISTANT_LIMITS.proposalTtlMinutes * 60_000
/** A change waiting for another member gets longer than one the asker reviews on the spot. */
export const APPROVAL_TTL_DAYS = 7
const approvalTtlMs = APPROVAL_TTL_DAYS * 24 * 60 * 60_000

const asPermission = (value: string | null | undefined): Permission | null =>
  value && isPermission(value) ? value : null

/** The permission a logged action needs: recorded on the row, else the action's own. */
const permissionOf = (row: Row): Permission | null =>
  asPermission(row.permission) ?? asPermission(undoerFor(row.tool)?.permission)

/**
 * A change a member made (admin, MCP, API) that their role sends for approval: stored as a
 * `runAdminAction` waiting in Approvals, with the permission that held it back. Runs nothing.
 */
export async function queueForApprover(
  tx: StoreTx,
  input: {
    storeId: string
    userId: string
    source: AiActionSource
    path: string
    input: unknown
    permission: Permission
    now: Date
  },
): Promise<ActionView> {
  const raw = { path: input.path, input: input.input }
  const proposal = queuedAdminAction(input.path, input.input)
  const [row] = await tx
    .insert(aiAction)
    .values({
      storeId: input.storeId,
      userId: input.userId,
      source: input.source,
      tool: adminAction.tool,
      summary: proposal.summary,
      input: { raw, resolved: proposal.resolved } satisfies Stored,
      preview: proposal.preview,
      needsApprover: true,
      permission: input.permission,
      expiresAt: new Date(input.now.getTime() + approvalTtlMs),
    })
    .returning()
  return oneView(tx, row as Row, input.now)
}

/** Hands an open proposal to Approvals: from now on a different member must approve it. */
async function sendToApprover(env: ActionEnv, id: string, permission: Permission | null) {
  const [updated] = await env.tx
    .update(aiAction)
    .set({
      needsApprover: true,
      permission,
      expiresAt: new Date(env.now.getTime() + approvalTtlMs),
      updatedAt: env.now,
    })
    .where(eq(aiAction.id, id))
    .returning()
  return oneView(env.tx, updated as Row, env.now)
}

/** Validates a propose tool's input and stores it as a proposal. Changes nothing else. */
export async function proposeAction(
  env: ActionEnv,
  tool: string,
  raw: unknown,
  opts: { flagged: boolean; source?: 'assistant' | 'mcp' },
): Promise<ActionView> {
  const definition = actionFor(tool)
  if (!definition) throw new ProposalProblem(`There is no ${tool} action.`)
  const parsed = definition.input.parse(raw) as Record<string, unknown>
  const proposal = await definition.propose(env, parsed)
  const [row] = await env.tx
    .insert(aiAction)
    .values({
      storeId: env.storeId,
      userId: env.userId,
      source: opts.source ?? 'assistant',
      tool,
      summary: proposal.summary,
      input: { raw: parsed, resolved: proposal.resolved } satisfies Stored,
      preview: proposal.preview,
      flagged: opts.flagged,
      expiresAt: new Date(env.now.getTime() + ttlMs),
    })
    .returning()
  return oneView(env.tx, row as Row, env.now)
}

/**
 * An open proposal the caller may decide, or a plain refusal.
 *
 * Waiting in Approvals (`needsApprover`): never the asker's to approve or edit, only to
 * withdraw; anyone else must pass `canApprove` for its permission.
 *
 * Otherwise: the assistant's proposals are the asker's alone. An MCP client's may also be
 * decided by the owner or a member whose role holds the action's permission; for
 * `runAdminAction` (no permission of its own) the admin procedure checks the approver's role
 * when it runs, and only the owner may edit or cancel it for someone.
 *
 * An expired one is refused with a message that says so (the refusal rolls the request back, so
 * the row itself is marked expired by the next Activity load).
 */
async function openFor(
  env: ActionEnv,
  scope: StoreScope,
  id: string,
  intent: 'approve' | 'edit' | 'cancel',
): Promise<Row> {
  const [row] = await env.tx.select().from(aiAction).where(eq(aiAction.id, id)).for('update')
  if (!row) throw new ORPCError('NOT_FOUND', { message: 'That AI action was not found.' })
  if (row.needsApprover) {
    if (row.userId === env.userId) {
      if (intent !== 'cancel') {
        throw new ORPCError('FORBIDDEN', {
          message: 'You asked for this change, so a different member has to approve it.',
        })
      }
    } else if (!canApprove(scope, permissionOf(row))) {
      throw new ORPCError('FORBIDDEN', { message: 'Your role cannot approve this change.' })
    }
  } else if (row.userId !== env.userId) {
    if (row.source !== 'mcp') {
      throw new ORPCError('FORBIDDEN', {
        message: 'Only the person who asked the assistant for this change can approve it.',
      })
    }
    const permission = undoerFor(row.tool)?.permission ?? null
    const allowed =
      scope.isOwner || (permission === null ? intent === 'approve' : scope.can(permission))
    if (!allowed) {
      throw new ORPCError('FORBIDDEN', { message: 'Your role does not allow this change.' })
    }
  }
  const status = statusAt(row, env.now)
  if (status === 'expired') {
    const again =
      row.source === 'mcp' ? 'Ask the AI app to propose it again.' : 'Ask the assistant again.'
    throw new ORPCError('CONFLICT', {
      message: `This request expired, so nothing was changed. ${again}`,
    })
  }
  if (status !== 'proposed') {
    throw new ORPCError('CONFLICT', { message: 'This suggestion was already handled.' })
  }
  return row
}

function requirePermission(scope: StoreScope, tool: string) {
  const undoer = undoerFor(tool)
  if (!undoer) throw new ORPCError('BAD_REQUEST', { message: 'Unknown AI action.' })
  // `runAdminAction` has no permission of its own: the admin procedure checks the approver's role.
  if (undoer.permission !== null && !scope.can(undoer.permission)) {
    throw new ORPCError('FORBIDDEN', { message: 'Your role does not allow this change.' })
  }
  return undoer
}

const coerce = (field: EditField | undefined, value: unknown) => {
  if (!field) return undefined
  if (value === null || value === '') return undefined
  if (field.kind === 'number') {
    const n = Number(value)
    return Number.isFinite(n) ? n : undefined
  }
  return String(value)
}

/** Edit on the card: the merchant's changes go through the same checks as the model's input. */
export async function reviseAction(
  env: ActionEnv,
  scope: StoreScope,
  id: string,
  changes: Record<string, string | number | null>,
): Promise<ActionView> {
  const row = await openFor(env, scope, id, 'edit')
  const definition = actionFor(row.tool)
  const stored = row.input as Stored
  if (!definition) throw new ORPCError('BAD_REQUEST', { message: 'Unknown AI action.' })
  const fields = definition.editFields(stored.raw as never)
  const raw = { ...stored.raw }
  for (const [key, value] of Object.entries(changes)) {
    const field = fields.find((f) => f.key === key)
    if (!field) continue
    const next = coerce(field, value)
    if (next === undefined) delete raw[key]
    else raw[key] = next
  }
  const parsed = definition.input.safeParse(raw)
  if (!parsed.success) {
    throw new ProposalProblem(parsed.error.issues.map((i) => i.message).join('. '))
  }
  const proposal = await definition.propose(env, parsed.data)
  const [updated] = await env.tx
    .update(aiAction)
    .set({
      summary: proposal.summary,
      input: {
        raw: parsed.data as Record<string, unknown>,
        resolved: proposal.resolved,
      } satisfies Stored,
      preview: proposal.preview,
      expiresAt: new Date(env.now.getTime() + ttlMs),
      updatedAt: env.now,
    })
    .where(eq(aiAction.id, id))
    .returning()
  return oneView(env.tx, updated as Row, env.now)
}

/**
 * Approve: runs the exact change the merchant saw, as them and with their permission, all or
 * nothing. A role that may not make the change is refused and the proposal stays open, so
 * someone who may can still approve it. A role that ticks "Needs approval" for it hands it to
 * Approvals instead (the owner never does).
 */
export async function approveAction(
  env: ActionEnv,
  scope: StoreScope,
  id: string,
): Promise<ActionView> {
  const row = await openFor(env, scope, id, 'approve')
  // A role without the grant is refused outright; one with it but ticked hands it on.
  requirePermission(scope, row.tool)
  const permission = permissionOf(row)
  if (!row.needsApprover && permission && mustAsk(scope, permission)) {
    return sendToApprover(env, id, permission)
  }
  const definition = actionFor(row.tool)
  if (!definition) throw new ORPCError('BAD_REQUEST', { message: 'Unknown AI action.' })
  const stored = row.input as Stored
  try {
    const done = await env.tx.transaction((sp) =>
      definition.execute({ ...env, tx: sp }, stored.resolved),
    )
    const [updated] = await env.tx
      .update(aiAction)
      .set({
        status: 'executed',
        result: {
          ...done.result,
          message: done.message,
          href: done.href,
          by: env.email,
          ...(row.source === 'mcp' && row.userId === env.userId ? { confirmedAi: true } : {}),
        },
        undo: done.undo ?? null,
        approvedBy: env.userId,
        approvedAt: env.now,
        executedAt: env.now,
        updatedAt: env.now,
      })
      .where(eq(aiAction.id, id))
      .returning()
    return oneView(env.tx, updated as Row, env.now)
  } catch (err) {
    if (err instanceof ApproverNotAllowed) {
      throw new ORPCError('FORBIDDEN', { message: err.message })
    }
    // The admin action's own permission is one this member's role sends for approval.
    if (err instanceof NeedsApprover && !row.needsApprover) {
      return sendToApprover(env, id, asPermission(err.permission))
    }
    const message =
      err instanceof ProposalProblem
        ? err.message
        : 'The change could not be made. Nothing was changed.'
    const [updated] = await env.tx
      .update(aiAction)
      .set({
        status: 'failed',
        error: message,
        approvedBy: env.userId,
        approvedAt: env.now,
        result: { by: env.email },
        updatedAt: env.now,
      })
      .where(eq(aiAction.id, id))
      .returning()
    return oneView(env.tx, updated as Row, env.now)
  }
}

/** Cancel (reject): records who did it as `by`. */
export async function cancelAction(
  env: ActionEnv,
  scope: StoreScope,
  id: string,
): Promise<ActionView> {
  await openFor(env, scope, id, 'cancel')
  const [updated] = await env.tx
    .update(aiAction)
    .set({ status: 'cancelled', result: { by: env.email }, updatedAt: env.now })
    .where(eq(aiAction.id, id))
    .returning()
  return oneView(env.tx, updated as Row, env.now)
}

/** Undo from Activity (or the card): any member whose role holds the action's permission. */
export async function undoAction(
  env: ActionEnv,
  scope: StoreScope,
  id: string,
): Promise<ActionView> {
  const [row] = await env.tx.select().from(aiAction).where(eq(aiAction.id, id))
  if (!row) throw new ORPCError('NOT_FOUND', { message: 'That AI action was not found.' })
  const undoer = requirePermission(scope, row.tool)
  if (row.status !== 'executed' || row.undo === null || !undoer.undo) {
    throw new ORPCError('CONFLICT', { message: 'This change cannot be undone.' })
  }
  const undo = undoer.undo
  try {
    const message = await env.tx.transaction((sp) => undo({ ...env, tx: sp }, row.undo))
    const [updated] = await env.tx
      .update(aiAction)
      .set({
        status: 'undone',
        undoneBy: env.userId,
        undoneAt: env.now,
        result: {
          ...((row.result ?? {}) as Outcome),
          undoMessage: message,
          undoneByEmail: env.email,
        },
        updatedAt: env.now,
      })
      .where(eq(aiAction.id, id))
      .returning()
    return oneView(env.tx, updated as Row, env.now)
  } catch (err) {
    if (err instanceof ProposalProblem) throw new ORPCError('CONFLICT', { message: err.message })
    throw err
  }
}

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

/** Settings → Approvals: changes waiting for a different member, and recent expired ones. */
export async function listWaitingApprovals(
  ctx: StoreContext,
  now: Date = new Date(),
): Promise<ActionView[]> {
  const rows = await ctx.tx
    .select()
    .from(aiAction)
    .where(
      and(
        eq(aiAction.needsApprover, true),
        inArray(aiAction.status, ['proposed', 'expired']),
        gte(aiAction.expiresAt, new Date(now.getTime() - approvalTtlMs)),
      ),
    )
    .orderBy(desc(aiAction.createdAt))
    .limit(200)
  return viewsOf(ctx.tx, rows, now)
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
      permission: aiAction.permission,
      expiresAt: aiAction.expiresAt,
      outcomeSeenAt: aiAction.outcomeSeenAt,
    })
    .from(aiAction)
    .where(
      and(
        eq(aiAction.needsApprover, true),
        gte(aiAction.createdAt, new Date(now.getTime() - 30 * 24 * 60 * 60_000)),
      ),
    )
  let waiting = 0
  let outcomes = 0
  for (const r of rows) {
    const open = r.status === 'proposed' && r.expiresAt.getTime() > now.getTime()
    if (r.userId === scope.userId) {
      if (!open && r.status !== 'proposed' && !r.outcomeSeenAt) outcomes++
    } else if (open && canApprove(scope, permissionOf(r as Row))) {
      waiting++
    }
  }
  return { waiting, outcomes }
}
