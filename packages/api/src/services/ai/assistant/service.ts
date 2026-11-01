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
 * One request per change (`duplicates.ts`): asking again for an open request returns it with
 * `alreadyRequested` instead of storing a copy, and deciding one closes its open twins.
 *
 * Nothing here is reachable by the model: it only ever creates `proposed` rows.
 */
import { ASSISTANT_LIMITS } from '@commerce/ai'
import type { Permission } from '@commerce/core/permissions'
import { type AiActionSource, aiAction, type StoreTx } from '@commerce/db'
import { ORPCError } from '@orpc/server'
import { eq } from 'drizzle-orm'
import { canApprove, mustAsk } from '../../../procedures/approval-rules'
import type { StoreScope } from '../../../procedures/store'
import { adminAction, queuedAdminAction } from './actions/admin-action'
import { ApproverNotAllowed, NeedsApprover, ProposalProblem } from './actions/resolve'
import type { ActionEnv, EditField } from './actions/types'
import { closeTwins, lockRequest, openTwin, requestKey } from './duplicates'
import { actionFor, undoerFor } from './registry'
import {
  type ActionView,
  approvalTtlMs,
  asPermission,
  type Outcome,
  oneView,
  permissionOf,
  type Row,
  type Stored,
  statusAt,
} from './views'

const ttlMs = ASSISTANT_LIMITS.proposalTtlMinutes * 60_000

/** The message an asker gets when the same change is already waiting. */
export const ALREADY_REQUESTED = 'Already requested — waiting for approval.'

/** An open request returned instead of storing the same one again. */
async function existing(tx: StoreTx, row: Row, now: Date): Promise<ActionView> {
  return { ...(await oneView(tx, row, now)), alreadyRequested: true }
}

/**
 * A change a member made (admin, MCP, API) that their role sends for approval: stored as a
 * `runAdminAction` waiting in Approvals, with the permission that held it back. Runs nothing.
 * When the same change already waits there (whoever asked), that one is returned instead.
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
  const ask = { storeId: input.storeId, tool: adminAction.tool, raw, now: input.now }
  await lockRequest(tx, input.storeId, requestKey(ask.tool, raw))
  const twin = await openTwin(tx, { ...ask, userId: null })
  if (twin) return existing(tx, twin, input.now)
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

/**
 * Hands an open proposal to Approvals: from now on a different member must approve it. When the
 * same change already waits there, this proposal is closed and says so (`alreadyRequested`).
 */
async function sendToApprover(env: ActionEnv, row: Row, permission: Permission | null) {
  const id = row.id
  const raw = (row.input as Partial<Stored>).raw ?? null
  await lockRequest(env.tx, env.storeId, requestKey(row.tool, raw))
  const twin = await openTwin(
    env.tx,
    { storeId: env.storeId, tool: row.tool, raw, userId: null, now: env.now },
    id,
  )
  if (twin) {
    const [closed] = await env.tx
      .update(aiAction)
      .set({
        status: 'cancelled',
        result: { message: ALREADY_REQUESTED, duplicateOf: twin.id },
        updatedAt: env.now,
      })
      .where(eq(aiAction.id, id))
      .returning()
    return existing(env.tx, closed as Row, env.now)
  }
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

/**
 * Validates a propose tool's input and stores it as a proposal. Changes nothing else. The asker's
 * own open request for the same change (a card, or one waiting in Approvals) is returned instead.
 */
export async function proposeAction(
  env: ActionEnv,
  tool: string,
  raw: unknown,
  opts: { flagged: boolean; source?: 'assistant' | 'mcp' },
): Promise<ActionView> {
  const definition = actionFor(tool)
  if (!definition) throw new ProposalProblem(`There is no ${tool} action.`)
  const parsed = definition.input.parse(raw) as Record<string, unknown>
  await lockRequest(env.tx, env.storeId, requestKey(tool, parsed))
  const twin = await openTwin(env.tx, {
    storeId: env.storeId,
    tool,
    raw: parsed,
    userId: env.userId,
    now: env.now,
  })
  if (twin) return existing(env.tx, twin, env.now)
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
    return sendToApprover(env, row, permission)
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
    // The change is made: copies of the same request leave the queue instead of failing later.
    await closeTwins(env.tx, row, 'approved', env.email, env.now)
    return oneView(env.tx, updated as Row, env.now)
  } catch (err) {
    if (err instanceof ApproverNotAllowed) {
      throw new ORPCError('FORBIDDEN', { message: err.message })
    }
    // The admin action's own permission is one this member's role sends for approval.
    if (err instanceof NeedsApprover && !row.needsApprover) {
      return sendToApprover(env, row, asPermission(err.permission))
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

/**
 * Cancel (reject): records who did it as `by`. A rejection closes the request's open twins too;
 * the asker withdrawing closes only their own copies.
 */
export async function cancelAction(
  env: ActionEnv,
  scope: StoreScope,
  id: string,
): Promise<ActionView> {
  const row = await openFor(env, scope, id, 'cancel')
  const how = row.userId === env.userId ? 'withdrawn' : 'rejected'
  await closeTwins(env.tx, row, how, env.email, env.now)
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
