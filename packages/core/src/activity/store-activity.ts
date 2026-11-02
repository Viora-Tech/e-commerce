/** SOURCE OF TRUTH: Settings → Activity log — WHAT: one row per change a member made (who, from where, which action, what changed), listed with filters and kept for a year / WHY: "who created this shipping zone?" must have an answer; request logs are sampled and never leave the container */
import {
  STORE_ACTIVITY_SOURCES,
  type StoreActivityChanges,
  type StoreActivitySource,
  type StoreTx,
  storeActivity,
} from '@commerce/db'
import { and, count, desc, eq, gte, ilike, lt, or, type SQL, sql } from 'drizzle-orm'
import { z } from 'zod'
import type { StoreContext } from '../context'

/** How long the log keeps a row (the worker's daily prune deletes older ones). */
const STORE_ACTIVITY_DAYS = 365
const DAY = 86_400_000

export type StoreActivityInput = {
  actorUserId: string | null
  actorName: string | null
  actorEmail: string | null
  source: StoreActivitySource
  action: string
  area: string
  resourceType?: string | null
  resourceId?: string | null
  summary: string
  changes?: StoreActivityChanges | null
  ip?: string | null
  userAgent?: string | null
  at?: Date
}

const clip = (value: string | null | undefined, max: number) => (value ? value.slice(0, max) : null)

/** Writes one row. The caller has already scrubbed `changes` (`scrubAudit`). */
export async function recordStoreActivity(
  tx: StoreTx,
  storeId: string,
  input: StoreActivityInput,
): Promise<void> {
  await tx.insert(storeActivity).values({
    storeId,
    actorUserId: input.actorUserId,
    actorName: clip(input.actorName, 200),
    actorEmail: clip(input.actorEmail, 320),
    source: input.source,
    action: input.action.slice(0, 200),
    area: input.area.slice(0, 60),
    resourceType: clip(input.resourceType, 120),
    resourceId: clip(input.resourceId, 120),
    summary: input.summary.slice(0, 300),
    changes: input.changes ?? null,
    ip: clip(input.ip, 64),
    userAgent: clip(input.userAgent, 400),
    createdAt: input.at ?? new Date(),
  })
}

export const StoreActivityQuerySchema = z.object({
  /** A member's user id. */
  actorUserId: z.string().min(1).max(120).optional(),
  area: z.string().min(1).max(60).optional(),
  source: z.enum(STORE_ACTIVITY_SOURCES).optional(),
  /** Matches the action (`shipping.zones`) or the summary ("Kinja"). */
  search: z.string().trim().max(200).optional(),
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
  limit: z.number().int().min(1).max(100).default(50),
  offset: z.number().int().min(0).max(100_000).default(0),
})
export type StoreActivityQuery = z.input<typeof StoreActivityQuerySchema>

export type StoreActivityRow = {
  id: string
  actorUserId: string | null
  actorName: string | null
  actorEmail: string | null
  source: StoreActivitySource
  action: string
  area: string
  resourceType: string | null
  resourceId: string | null
  summary: string
  changes: StoreActivityChanges | null
  ip: string | null
  userAgent: string | null
  createdAt: Date
}

const escapeLike = (text: string) => text.replace(/[\\%_]/g, (c) => `\\${c}`)

/** The log, newest first, one page at a time, with the total for the pager. */
export async function listStoreActivity(
  ctx: StoreContext,
  query: StoreActivityQuery,
): Promise<{ rows: StoreActivityRow[]; total: number }> {
  const q = StoreActivityQuerySchema.parse(query)
  const where: SQL[] = []
  if (q.actorUserId) where.push(eq(storeActivity.actorUserId, q.actorUserId))
  if (q.area) where.push(eq(storeActivity.area, q.area))
  if (q.source) where.push(eq(storeActivity.source, q.source))
  if (q.from) where.push(gte(storeActivity.createdAt, new Date(q.from)))
  if (q.to) where.push(lt(storeActivity.createdAt, new Date(q.to)))
  if (q.search) {
    const like = `%${escapeLike(q.search)}%`
    const match = or(ilike(storeActivity.action, like), ilike(storeActivity.summary, like))
    if (match) where.push(match)
  }
  const filter = where.length ? and(...where) : undefined
  const rows = await ctx.tx
    .select()
    .from(storeActivity)
    .where(filter)
    .orderBy(desc(storeActivity.createdAt), desc(storeActivity.id))
    .limit(q.limit)
    .offset(q.offset)
  const [counted] = await ctx.tx.select({ n: count() }).from(storeActivity).where(filter)
  return {
    rows: rows.map(({ storeId: _storeId, ...row }) => row),
    total: counted?.n ?? 0,
  }
}

/** Everyone who appears in the log (the Person filter), latest name and email first. */
export async function listStoreActivityPeople(
  ctx: StoreContext,
): Promise<{ userId: string; name: string | null; email: string | null }[]> {
  const rows = await ctx.tx
    .selectDistinctOn([storeActivity.actorUserId], {
      userId: storeActivity.actorUserId,
      name: storeActivity.actorName,
      email: storeActivity.actorEmail,
    })
    .from(storeActivity)
    .where(sql`${storeActivity.actorUserId} is not null`)
    .orderBy(storeActivity.actorUserId, desc(storeActivity.createdAt))
    .limit(500)
  return rows
    .flatMap((r) => (r.userId ? [{ userId: r.userId, name: r.name, email: r.email }] : []))
    .sort((a, b) => (a.name ?? a.email ?? '').localeCompare(b.name ?? b.email ?? ''))
}

/** Rows older than a year go (the worker's daily sweep). */
export async function pruneStoreActivity(ctx: StoreContext, now = new Date()): Promise<number> {
  const rows = await ctx.tx
    .delete(storeActivity)
    .where(lt(storeActivity.createdAt, new Date(now.getTime() - STORE_ACTIVITY_DAYS * DAY)))
    .returning({ id: storeActivity.id })
  return rows.length
}
