/** How a logged assistant action reads on the cards, in Activity and in Approvals. */
import { isPermission, type Permission } from '@commerce/core/permissions'
import {
  type AiActionSource,
  type AiActionStatus,
  type aiAction,
  authSchema,
  type StoreTx,
} from '@commerce/db'
import { inArray } from 'drizzle-orm'
import type { ActionPreview, EditField } from './actions/types'
import { actionFor, undoerFor } from './registry'

export type Stored = {
  raw: Record<string, unknown>
  resolved: unknown
}

export type Outcome = {
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

export type Row = typeof aiAction.$inferSelect

/** A proposal past its expiry reads as expired even before a list marks it so. */
export const statusAt = (row: Row, now: Date): AiActionStatus =>
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

export async function viewsOf(tx: StoreTx, rows: Row[], now: Date): Promise<ActionView[]> {
  const names = await namesOf(
    tx,
    rows.map((r) => r.userId),
  )
  return rows.map((r) => viewOf(r, names.get(r.userId) ?? null, now))
}

export async function oneView(tx: StoreTx, row: Row, now: Date): Promise<ActionView> {
  const [view] = await viewsOf(tx, [row], now)
  return view as ActionView
}

/** A change waiting for another member gets longer than one the asker reviews on the spot. */
const APPROVAL_TTL_DAYS = 7
export const approvalTtlMs = APPROVAL_TTL_DAYS * 24 * 60 * 60_000

export const asPermission = (value: string | null | undefined): Permission | null =>
  value && isPermission(value) ? value : null

/** The permission a logged action needs: recorded on the row, else the action's own. */
export const permissionOf = (row: Row): Permission | null =>
  asPermission(row.permission) ?? asPermission(undoerFor(row.tool)?.permission)
