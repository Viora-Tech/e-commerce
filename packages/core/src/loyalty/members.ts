/** SOURCE OF TRUTH: loyalty members list and bulk points — WHAT: the paged members list (search, tier and status filters; name, status, tier, points, lifetime points, total spent), CSV export, CSV import of points balances (set or add), and resetting every member's points / WHY: the admin Members page and its bulk tools; every change goes through `addPoints`/`takePoints` so the ledger explains it */
import { customer, loyaltyEntry, loyaltyMember, loyaltyTier } from '@commerce/db'
import { and, asc, desc, eq, ilike, inArray, isNull, or, type SQL, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { customerSpentSql } from '../customers/spent'
import { addPoints, takePoints } from './balance'
import { pointsSummary } from './ledger'
import { ensureMember } from './member'
import type { LoyaltySettings } from './settings'

/** Earning only (not rewards, their refunds, expiry or resets): the lifetime points figure. */
const lifetimePointsSql = sql<number>`(select coalesce(sum(le.points), 0)::int from loyalty_entry le
  where le.customer_id = ${loyaltyMember.customerId} and le.status = 'credited' and le.points > 0
    and le.source not in ('redemption_refund', 'import'))`

export type MemberStatus = 'active' | 'excluded'

export type LoyaltyMemberListInput = {
  page?: number | undefined
  perPage?: number | undefined
  search?: string | undefined
  tierId?: string | 'none' | undefined
  status?: MemberStatus | 'all' | undefined
  sort?: 'joined' | 'lifetime_points' | 'total_spent' | 'name' | undefined
  dir?: 'asc' | 'desc' | undefined
}

export type LoyaltyMemberListRow = {
  customerId: string
  name: string | null
  email: string | null
  status: MemberStatus
  tierId: string | null
  tierName: string | null
  points: number
  lifetimePoints: number
  totalSpentPaise: number
  joinedAt: Date
}

function excludedSql(settings: LoyaltySettings): SQL<boolean> {
  if (settings.excludeTags.length === 0) return sql<boolean>`false`
  return sql<boolean>`(${customer.tags} && array[${sql.join(
    settings.excludeTags.map((t) => sql`${t}`),
    sql`, `,
  )}]::text[])`
}

/**
 * One page of members. Points are each member's live balance (both homes), worked out for the
 * page only; sorting is by joined date, lifetime points, total spent or name.
 */
export async function listLoyaltyMembers(
  ctx: StoreContext,
  input: LoyaltyMemberListInput,
  settings: LoyaltySettings,
  now: Date = new Date(),
): Promise<{ rows: LoyaltyMemberListRow[]; total: number; page: number; perPage: number }> {
  const page = Math.max(1, input.page ?? 1)
  const perPage = Math.min(100, Math.max(1, input.perPage ?? 25))
  const excluded = excludedSql(settings)
  const q = input.search?.trim()
  const where = and(
    isNull(customer.anonymisedAt),
    q
      ? or(
          ilike(customer.name, `%${q}%`),
          ilike(customer.email, `%${q}%`),
          eq(loyaltyMember.referralCode, q.toUpperCase()),
        )
      : undefined,
    input.tierId === 'none'
      ? isNull(loyaltyMember.tierId)
      : input.tierId
        ? eq(loyaltyMember.tierId, input.tierId)
        : undefined,
    input.status === 'excluded'
      ? excluded
      : input.status === 'active'
        ? sql`not ${excluded}`
        : undefined,
  )
  const spent = customerSpentSql(sql`${customer.id}`)
  const dir = input.dir === 'asc' ? asc : desc
  const order =
    input.sort === 'lifetime_points'
      ? dir(lifetimePointsSql)
      : input.sort === 'total_spent'
        ? dir(spent)
        : input.sort === 'name'
          ? dir(customer.name)
          : dir(loyaltyMember.joinedAt)
  const base = ctx.tx
    .select({
      customerId: loyaltyMember.customerId,
      name: customer.name,
      email: customer.email,
      excluded,
      tierId: loyaltyMember.tierId,
      tierName: loyaltyTier.name,
      lifetimePoints: lifetimePointsSql,
      totalSpentPaise: spent,
      joinedAt: loyaltyMember.joinedAt,
    })
    .from(loyaltyMember)
    .innerJoin(customer, eq(customer.id, loyaltyMember.customerId))
    .leftJoin(loyaltyTier, eq(loyaltyTier.id, loyaltyMember.tierId))
    .where(where)
  const rows = await base
    .orderBy(order, asc(loyaltyMember.id))
    .limit(perPage)
    .offset((page - 1) * perPage)
  const [count] = await ctx.tx
    .select({ n: sql<number>`count(*)::int` })
    .from(loyaltyMember)
    .innerJoin(customer, eq(customer.id, loyaltyMember.customerId))
    .where(where)
  const out: LoyaltyMemberListRow[] = []
  for (const r of rows) {
    const { points } = await pointsSummary(ctx, r.customerId, 0, now)
    out.push({
      customerId: r.customerId,
      name: r.name,
      email: r.email,
      status: r.excluded ? 'excluded' : 'active',
      tierId: r.tierId,
      tierName: r.tierName,
      points,
      lifetimePoints: r.lifetimePoints,
      totalSpentPaise: r.totalSpentPaise,
      joinedAt: r.joinedAt,
    })
  }
  return { rows: out, total: count?.n ?? 0, page, perPage }
}

const csvCell = (v: string | number | null) => {
  const s = v === null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** Every member as CSV: email, name, status, tier, points, lifetime_points, total_spent (₹). */
export async function exportMembersCsv(
  ctx: StoreContext,
  settings: LoyaltySettings,
  now: Date = new Date(),
): Promise<string> {
  const lines = ['email,name,status,tier,points,lifetime_points,total_spent']
  for (let page = 1; ; page++) {
    const { rows } = await listLoyaltyMembers(
      ctx,
      { page, perPage: 100, sort: 'joined', dir: 'asc' },
      settings,
      now,
    )
    for (const r of rows) {
      lines.push(
        [
          r.email,
          r.name,
          r.status,
          r.tierName,
          r.points,
          r.lifetimePoints,
          (r.totalSpentPaise / 100).toFixed(2),
        ]
          .map(csvCell)
          .join(','),
      )
    }
    if (rows.length < 100) break
  }
  return `${lines.join('\n')}\n`
}

/**
 * Reads an import file: a header with `email` and `points` (any order, any case), one row per
 * customer. Rows with no email or a points value that is not a whole number 0 or above are
 * reported. Pure.
 */
export function parsePointsCsv(text: string): {
  rows: { email: string; points: number }[]
  errors: { line: number; message: string }[]
} {
  const lines = text
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim() !== '')
  const head = (lines[0] ?? '').split(',').map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ''))
  const ei = head.indexOf('email')
  const pi = head.indexOf('points')
  if (ei < 0 || pi < 0)
    return { rows: [], errors: [{ line: 1, message: 'Needs email and points columns' }] }
  const rows: { email: string; points: number }[] = []
  const errors: { line: number; message: string }[] = []
  lines.slice(1).forEach((l, i) => {
    const cells = l.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
    const email = (cells[ei] ?? '').toLowerCase()
    const points = Number(cells[pi])
    if (!email.includes('@')) errors.push({ line: i + 2, message: 'No email' })
    else if (!Number.isInteger(points) || points < 0)
      errors.push({ line: i + 2, message: 'Points must be a whole number' })
    else rows.push({ email, points })
  })
  return { rows, errors }
}

/**
 * Imports balances: `set` makes each customer's points exactly the number (adding or taking
 * the difference), `add` adds it. Customers are found by email; unknown emails are skipped and
 * reported. Each change is an `import` entry. Returns what happened.
 */
export async function importPointBalances(
  ctx: StoreContext,
  input: {
    rows: { email: string; points: number }[]
    mode: 'set' | 'add'
    staffEmail: string | null
  },
  settings: LoyaltySettings,
  now: Date = new Date(),
): Promise<{ updated: number; unchanged: number; skipped: { email: string; reason: string }[] }> {
  const emails = [...new Set(input.rows.map((r) => r.email.toLowerCase()))]
  const found = emails.length
    ? await ctx.tx
        .select({ id: customer.id, email: customer.email })
        .from(customer)
        .where(inArray(sql`lower(${customer.email})`, emails))
    : []
  const byEmail = new Map(found.map((c) => [(c.email ?? '').toLowerCase(), c.id]))
  let updated = 0
  let unchanged = 0
  const skipped: { email: string; reason: string }[] = []
  for (const row of input.rows) {
    const customerId = byEmail.get(row.email.toLowerCase())
    if (!customerId) {
      skipped.push({ email: row.email, reason: 'No customer with this email' })
      continue
    }
    await ensureMember(ctx, customerId, now)
    const current = input.mode === 'set' ? (await pointsSummary(ctx, customerId, 0, now)).points : 0
    const delta = input.mode === 'set' ? row.points - current : row.points
    const move = {
      customerId,
      source: 'import' as const,
      reason: 'Points imported',
      staffEmail: input.staffEmail,
    }
    if (delta > 0) await addPoints(ctx, { ...move, points: delta }, settings, now)
    else if (delta < 0) await takePoints(ctx, { ...move, points: -delta, upTo: true }, now)
    if (delta === 0) unchanged += 1
    else updated += 1
  }
  return { updated, unchanged, skipped }
}

/**
 * Takes every member's points to 0 (a `reset` entry each) and cancels points on the way.
 * Rewards already issued keep working. Returns how many members had points taken.
 */
export async function resetAllPoints(
  ctx: StoreContext,
  staffEmail: string | null,
  now: Date = new Date(),
): Promise<{ members: number; points: number }> {
  await ctx.tx
    .update(loyaltyEntry)
    .set({ status: 'cancelled' })
    .where(eq(loyaltyEntry.status, 'pending'))
  const members = await ctx.tx.select({ customerId: loyaltyMember.customerId }).from(loyaltyMember)
  let n = 0
  let total = 0
  for (const m of members) {
    const { points } = await pointsSummary(ctx, m.customerId, 0, now)
    if (points <= 0) continue
    const r = await takePoints(
      ctx,
      {
        customerId: m.customerId,
        points,
        source: 'reset',
        reason: 'All points reset',
        staffEmail,
        upTo: true,
      },
      now,
    )
    if (r.taken > 0) {
      n += 1
      total += r.taken
    }
  }
  return { members: n, points: total }
}
