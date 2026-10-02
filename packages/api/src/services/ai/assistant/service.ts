/**
 * The approval flow for assistant actions, over the `ai_action` log:
 *
 *   model calls a propose tool → `proposeAction` validates and stores it as `proposed`
 *   merchant clicks Edit       → `reviseAction` re-runs the proposal with their changes
 *   merchant clicks Approve    → `approveAction` checks it is theirs, still open, and that
 *                                their role holds the action's permission, then runs it in
 *                                a savepoint inside their RLS transaction
 *   merchant clicks Cancel     → `cancelAction`
 *   Activity → Undo            → `undoAction` (same permission check)
 *
 * Nothing here is reachable by the model: it only ever creates `proposed` rows.
 */
import { ASSISTANT_LIMITS } from '@commerce/ai'
import type { StoreContext } from '@commerce/core'
import { type AiActionStatus, aiAction } from '@commerce/db'
import { ORPCError } from '@orpc/server'
import { and, desc, eq, lt } from 'drizzle-orm'
import type { StoreScope } from '../../../procedures'
import { ProposalProblem } from './actions/resolve'
import type { ActionEnv, ActionPreview, EditField } from './actions/types'
import { ACTIONS, undoerFor } from './registry'

type Stored = {
  raw: Record<string, unknown>
  resolved: unknown
}

type Outcome = {
  message?: string
  href?: string | null
  by?: string
  undoMessage?: string
  undoneByEmail?: string
}

export type ActionView = {
  id: string
  tool: string
  source: 'assistant' | 'bulkWriter'
  status: AiActionStatus
  summary: string
  preview: ActionPreview
  editable: EditField[]
  flagged: boolean
  error: string | null
  message: string | null
  href: string | null
  canUndo: boolean
  by: string | null
  createdAt: Date
  expiresAt: Date
  executedAt: Date | null
  undoneAt: Date | null
  undoMessage: string | null
}

type Row = typeof aiAction.$inferSelect

function viewOf(row: Row): ActionView {
  const stored = row.input as Partial<Stored>
  const outcome = (row.result ?? {}) as Outcome
  const definition = ACTIONS[row.tool]
  const editable =
    row.status === 'proposed' && definition && stored.raw
      ? definition.editFields(stored.raw as never)
      : []
  return {
    id: row.id,
    tool: row.tool,
    source: row.source,
    status: row.status,
    summary: row.summary,
    preview: row.preview as ActionPreview,
    editable,
    flagged: row.flagged,
    error: row.error,
    message: outcome.message ?? null,
    href: outcome.href ?? null,
    canUndo: row.status === 'executed' && row.undo !== null,
    by: outcome.by ?? null,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    executedAt: row.executedAt,
    undoneAt: row.undoneAt,
    undoMessage: outcome.undoMessage ?? null,
  }
}

const ttlMs = ASSISTANT_LIMITS.proposalTtlMinutes * 60_000

/** Validates a propose tool's input and stores it as a proposal. Changes nothing else. */
export async function proposeAction(
  env: ActionEnv,
  tool: string,
  raw: unknown,
  opts: { flagged: boolean },
): Promise<ActionView> {
  const definition = ACTIONS[tool]
  if (!definition) throw new ProposalProblem(`There is no ${tool} action.`)
  const parsed = definition.input.parse(raw) as Record<string, unknown>
  const proposal = await definition.propose(env, parsed)
  const [row] = await env.tx
    .insert(aiAction)
    .values({
      storeId: env.storeId,
      userId: env.userId,
      tool,
      summary: proposal.summary,
      input: { raw: parsed, resolved: proposal.resolved } satisfies Stored,
      preview: proposal.preview,
      flagged: opts.flagged,
      expiresAt: new Date(env.now.getTime() + ttlMs),
    })
    .returning()
  return viewOf(row as Row)
}

/** The caller's own open proposal, or a plain refusal. Expired ones are marked on the way. */
async function ownOpen(env: ActionEnv, id: string): Promise<Row> {
  const [row] = await env.tx.select().from(aiAction).where(eq(aiAction.id, id))
  if (!row) throw new ORPCError('NOT_FOUND', { message: 'That AI action was not found.' })
  if (row.userId !== env.userId) {
    throw new ORPCError('FORBIDDEN', {
      message: 'Only the person who asked for this change can approve it.',
    })
  }
  if (row.status === 'proposed' && row.expiresAt.getTime() <= env.now.getTime()) {
    await env.tx
      .update(aiAction)
      .set({ status: 'expired', updatedAt: env.now })
      .where(eq(aiAction.id, id))
    throw new ORPCError('CONFLICT', {
      message: 'This suggestion expired. Ask the assistant again.',
    })
  }
  if (row.status !== 'proposed') {
    throw new ORPCError('CONFLICT', { message: 'This suggestion was already handled.' })
  }
  return row
}

function requirePermission(scope: StoreScope, tool: string) {
  const undoer = undoerFor(tool)
  if (!undoer) throw new ORPCError('BAD_REQUEST', { message: 'Unknown AI action.' })
  if (!scope.can(undoer.permission)) {
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
  id: string,
  changes: Record<string, string | number | null>,
): Promise<ActionView> {
  const row = await ownOpen(env, id)
  const definition = ACTIONS[row.tool]
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
  return viewOf(updated as Row)
}

/** Approve: runs the exact change the merchant saw, with their permission, all or nothing. */
export async function approveAction(
  env: ActionEnv,
  scope: StoreScope,
  id: string,
): Promise<ActionView> {
  const row = await ownOpen(env, id)
  requirePermission(scope, row.tool)
  const definition = ACTIONS[row.tool]
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
        result: { ...done.result, message: done.message, href: done.href, by: env.email },
        undo: done.undo ?? null,
        approvedBy: env.userId,
        approvedAt: env.now,
        executedAt: env.now,
        updatedAt: env.now,
      })
      .where(eq(aiAction.id, id))
      .returning()
    return viewOf(updated as Row)
  } catch (err) {
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
    return viewOf(updated as Row)
  }
}

export async function cancelAction(env: ActionEnv, id: string): Promise<ActionView> {
  await ownOpen(env, id)
  const [updated] = await env.tx
    .update(aiAction)
    .set({ status: 'cancelled', updatedAt: env.now })
    .where(eq(aiAction.id, id))
    .returning()
  return viewOf(updated as Row)
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
    return viewOf(updated as Row)
  } catch (err) {
    if (err instanceof ProposalProblem) throw new ORPCError('CONFLICT', { message: err.message })
    throw err
  }
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
    items: rows.slice(0, input.perPage).map(viewOf),
    hasMore: rows.length > input.perPage,
  }
}
