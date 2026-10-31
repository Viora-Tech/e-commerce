/**
 * One request per change: the same action with the same input, still open, is one request no
 * matter how often it was asked for (a double click, the AI asking twice, two members asking for
 * the same refund). Its key is the action and its input with object keys in a fixed order, so
 * `{ a, b }` and `{ b, a }` are the same request; list order still counts.
 *
 * Who it belongs to: a request waiting in Approvals is the store's (any member may approve it,
 * and approving it once makes the change), so a second asker is told it is already waiting. A
 * proposal the asker reviews on the spot (an AI card) stays theirs: only their own repeat folds
 * into it, so a member who may make a change is never blocked by somebody else's request.
 *
 * Computed in code from the stored input, so no column or migration is needed.
 */
import { aiAction, type StoreTx } from '@commerce/db'
import { and, asc, eq, gt, ne, sql } from 'drizzle-orm'
import type { Row, Stored } from './views'

/** JSON with object keys sorted, undefined dropped (as the stored jsonb drops it). */
function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) {
    return `[${value.map((v) => (v === undefined ? 'null' : canonical(v))).join(',')}]`
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`
}

/** The stable key of a request: its action and its input. */
export const requestKey = (tool: string, raw: unknown): string => `${tool}|${canonical(raw)}`

/** The key of a logged action. */
export const keyOfRow = (row: Row): string =>
  requestKey(row.tool, (row.input as Partial<Stored> | null)?.raw ?? null)

/**
 * Serialises two asks for the same change at once (a double click), so the second finds the
 * first instead of both inserting. Held until the transaction ends.
 */
export async function lockRequest(tx: StoreTx, storeId: string, key: string): Promise<void> {
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`ai_request:${storeId}:${key}`}, 0))`,
  )
}

/**
 * Open requests with this key: `userId` set → that member's own (on a card or in Approvals);
 * null → any member's waiting in Approvals. Oldest first.
 */
async function openWithKey(
  tx: StoreTx,
  input: { storeId: string; key: string; tool: string; userId: string | null; now: Date },
  exceptId?: string,
): Promise<Row[]> {
  const rows = await tx
    .select()
    .from(aiAction)
    .where(
      and(
        eq(aiAction.storeId, input.storeId),
        eq(aiAction.tool, input.tool),
        eq(aiAction.status, 'proposed'),
        gt(aiAction.expiresAt, input.now),
        input.userId === null
          ? eq(aiAction.needsApprover, true)
          : eq(aiAction.userId, input.userId),
        exceptId ? ne(aiAction.id, exceptId) : undefined,
      ),
    )
    .orderBy(asc(aiAction.createdAt))
  return rows.filter((r) => keyOfRow(r) === input.key)
}

/** The open request this one repeats, if any (see the file comment for whose count). */
export async function openTwin(
  tx: StoreTx,
  input: { storeId: string; tool: string; raw: unknown; userId: string | null; now: Date },
  exceptId?: string,
): Promise<Row | null> {
  const key = requestKey(input.tool, input.raw)
  const [twin] = await openWithKey(tx, { ...input, key }, exceptId)
  return twin ?? null
}

/** What a closed twin says in Activity and in the asker's requests. */
const CLOSED_MESSAGE = {
  approved: 'Already approved in another request for the same change.',
  rejected: 'Rejected in another request for the same change.',
  withdrawn: 'Withdrawn together with the same request.',
} as const

/**
 * Once a request is decided, its open twins go with it, so nobody is left a copy that can no
 * longer be approved. Approved or rejected: every twin waiting in Approvals plus the asker's own
 * cards. Withdrawn by the asker: only the asker's own twins (another member's request stands).
 */
export async function closeTwins(
  tx: StoreTx,
  decided: Row,
  how: keyof typeof CLOSED_MESSAGE,
  by: string,
  now: Date,
): Promise<number> {
  const base = { storeId: decided.storeId, key: keyOfRow(decided), tool: decided.tool, now }
  const own = await openWithKey(tx, { ...base, userId: decided.userId }, decided.id)
  const waiting =
    how === 'withdrawn' ? [] : await openWithKey(tx, { ...base, userId: null }, decided.id)
  const ids = [...new Set([...own, ...waiting].map((r) => r.id))]
  for (const id of ids) {
    await tx
      .update(aiAction)
      .set({
        status: 'cancelled',
        result: { by, message: CLOSED_MESSAGE[how], duplicateOf: decided.id },
        updatedAt: now,
      })
      .where(eq(aiAction.id, id))
  }
  return ids.length
}

/** A list with each open request once (the first seen); decided and expired rows stay as they are. */
export function onePerRequest(rows: Row[]): Row[] {
  const seen = new Set<string>()
  return rows.filter((r) => {
    if (r.status !== 'proposed') return true
    const key = keyOfRow(r)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
