/** SOURCE OF TRUTH: affiliate programs — WHAT: the default program, more programs, moving affiliates between them and an affiliate's own rate / WHY: every order, signup and coupon is worked out under one program */

import { appSettingsOf, parseAppsSettings } from '@commerce/core'
import { slugify } from '@commerce/core/catalog'
import { discount, type StoreTx, store } from '@commerce/db'
import { and, asc, eq, isNull, ne, sql } from 'drizzle-orm'
import { affiliate, affiliateProgram } from './schema'
import {
  AFFILIATES_ID,
  type CommissionRule,
  CommissionRuleSchema,
  PROGRAM_SLUG,
  type ProgramRules,
  ProgramRulesSchema,
  parseProgramRules,
} from './settings'
import { AffiliateError } from './store-settings'

export type ProgramRow = typeof affiliateProgram.$inferSelect
export type Program = Omit<ProgramRow, 'rules'> & { rules: ProgramRules }

const DEFAULT_SLUG = 'default'

function toProgram(row: ProgramRow): Program {
  return { ...row, rules: parseProgramRules(row.rules) }
}

/**
 * The store's default program, made on first use for stores that installed the app after
 * migration 0163. Its rules start from the store entry's v1 program keys (or the defaults).
 */
export async function defaultProgram(tx: StoreTx, storeId: string): Promise<Program> {
  const [found] = await tx
    .select()
    .from(affiliateProgram)
    .where(and(eq(affiliateProgram.storeId, storeId), eq(affiliateProgram.isDefault, true)))
  if (found) return toProgram(found)
  const [s] = await tx.select({ apps: store.apps }).from(store).where(eq(store.id, storeId))
  const rules = parseProgramRules(appSettingsOf(parseAppsSettings(s?.apps), AFFILIATES_ID))
  await tx
    .insert(affiliateProgram)
    .values({
      storeId,
      name: 'Default',
      slug: await freeSlug(tx, storeId, DEFAULT_SLUG),
      isDefault: true,
      rules,
    })
    .onConflictDoNothing()
  const [made] = await tx
    .select()
    .from(affiliateProgram)
    .where(and(eq(affiliateProgram.storeId, storeId), eq(affiliateProgram.isDefault, true)))
  if (!made) throw new AffiliateError('PROGRAM_NOT_SAVED', 'Program not saved')
  return toProgram(made)
}

export async function getProgram(tx: StoreTx, id: string): Promise<Program | null> {
  const [row] = await tx.select().from(affiliateProgram).where(eq(affiliateProgram.id, id))
  return row ? toProgram(row) : null
}

/** An open program by its link slug, or null (archived programs take no signups). */
export async function programBySlug(
  tx: StoreTx,
  storeId: string,
  slug: string,
): Promise<Program | null> {
  const [row] = await tx
    .select()
    .from(affiliateProgram)
    .where(
      and(
        eq(affiliateProgram.storeId, storeId),
        eq(affiliateProgram.slug, slug.toLowerCase()),
        isNull(affiliateProgram.archivedAt),
      ),
    )
  return row ? toProgram(row) : null
}

/** An affiliate's program: theirs, else the store's default. */
export async function programOf(
  tx: StoreTx,
  storeId: string,
  a: { programId: string | null },
): Promise<Program> {
  if (a.programId) {
    const p = await getProgram(tx, a.programId)
    if (p) return p
  }
  return defaultProgram(tx, storeId)
}

export type ProgramListItem = Program & { affiliates: number }

/** Default first, then by name; archived ones last. With how many affiliates each has. */
export async function listPrograms(tx: StoreTx, storeId: string): Promise<ProgramListItem[]> {
  const fallback = await defaultProgram(tx, storeId)
  const rows = await tx
    .select()
    .from(affiliateProgram)
    .orderBy(asc(affiliateProgram.archivedAt), asc(affiliateProgram.name))
  const counts = await tx
    .select({
      programId: affiliate.programId,
      n: sql<number>`count(*)::int`,
    })
    .from(affiliate)
    .groupBy(affiliate.programId)
  const countOf = (id: string) =>
    counts
      .filter((c) => c.programId === id || (c.programId === null && id === fallback.id))
      .reduce((s, c) => s + c.n, 0)
  return rows
    .map((r) => ({ ...toProgram(r), affiliates: countOf(r.id) }))
    .sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
}

/** A free slug from a wish: `creators`, else `creators-2`, `creators-3`... */
async function freeSlug(
  tx: StoreTx,
  storeId: string,
  wanted: string,
  exceptId?: string,
): Promise<string> {
  const base = slugify(wanted).slice(0, 32).replace(/-+$/, '') || 'program'
  for (let n = 1; n < 200; n++) {
    const slug = n === 1 ? base : `${base}-${n}`
    const [taken] = await tx
      .select({ id: affiliateProgram.id })
      .from(affiliateProgram)
      .where(
        and(
          eq(affiliateProgram.storeId, storeId),
          eq(affiliateProgram.slug, slug),
          exceptId ? ne(affiliateProgram.id, exceptId) : undefined,
        ),
      )
    if (!taken) return slug
  }
  return `${base}-${crypto.randomUUID().slice(0, 6)}`
}

export type ProgramInput = { name: string; slug?: string | undefined; rules: ProgramRules }

function cleanName(name: string): string {
  const n = name.trim().slice(0, 80)
  if (!n) throw new AffiliateError('PROGRAM_NAME', 'Give the program a name')
  return n
}

/** A new program, starting from the rules given (the admin copies the default's). */
export async function createProgram(
  tx: StoreTx,
  storeId: string,
  input: ProgramInput,
): Promise<Program> {
  await defaultProgram(tx, storeId)
  const name = cleanName(input.name)
  const [row] = await tx
    .insert(affiliateProgram)
    .values({
      storeId,
      name,
      slug: await freeSlug(tx, storeId, input.slug || name),
      rules: ProgramRulesSchema.parse(input.rules),
    })
    .returning()
  if (!row) throw new AffiliateError('PROGRAM_NOT_SAVED', 'Program not saved')
  return toProgram(row)
}

/**
 * Saves a program's name, slug and rules. New rules apply to new orders only: a commission is
 * set when its order is placed. The program's affiliates' codes take its new discount.
 */
export async function saveProgram(
  tx: StoreTx,
  storeId: string,
  id: string,
  input: ProgramInput,
): Promise<Program> {
  const current = await getProgram(tx, id)
  if (!current) throw new AffiliateError('PROGRAM_NOT_FOUND', 'Program not found')
  const wanted = (input.slug ?? current.slug).trim().toLowerCase()
  if (!PROGRAM_SLUG.test(wanted)) {
    throw new AffiliateError('PROGRAM_SLUG', 'Use lower-case letters, numbers and dashes')
  }
  const slug = await freeSlug(tx, storeId, wanted, id)
  if (slug !== wanted)
    throw new AffiliateError('PROGRAM_SLUG_TAKEN', 'Another program uses that link')
  const rules = ProgramRulesSchema.parse(input.rules)
  const [row] = await tx
    .update(affiliateProgram)
    .set({ name: cleanName(input.name), slug, rules, updatedAt: new Date() })
    .where(eq(affiliateProgram.id, id))
    .returning()
  if (!row) throw new AffiliateError('PROGRAM_NOT_FOUND', 'Program not found')
  if (rules.coupon.bp !== current.rules.coupon.bp) {
    await syncCouponValues(tx, storeId, id, current.isDefault, rules.coupon.bp)
  }
  return toProgram(row)
}

/** The program's affiliates' personal codes take its discount. */
async function syncCouponValues(
  tx: StoreTx,
  storeId: string,
  programId: string,
  isDefault: boolean,
  bp: number,
): Promise<void> {
  const inProgram = isDefault
    ? sql`(${affiliate.programId} = ${programId} or ${affiliate.programId} is null)`
    : eq(affiliate.programId, programId)
  await tx
    .update(discount)
    .set({ value: bp, updatedAt: new Date() })
    .where(
      sql`${discount.id} in (select ${affiliate.discountId} from ${affiliate} where ${affiliate.storeId} = ${storeId} and ${inProgram})`,
    )
}

/**
 * Moves one affiliate to another program. Their pending commissions keep their amounts (set
 * when the order was placed); new orders earn under the new program, and their code takes the
 * new program's discount.
 */
export async function setAffiliateProgram(
  tx: StoreTx,
  storeId: string,
  affiliateId: string,
  programId: string,
): Promise<void> {
  const p = await getProgram(tx, programId)
  if (!p || p.archivedAt) throw new AffiliateError('PROGRAM_NOT_FOUND', 'Program not found')
  const [row] = await tx
    .update(affiliate)
    .set({ programId: p.id, updatedAt: new Date() })
    .where(eq(affiliate.id, affiliateId))
    .returning({ discountId: affiliate.discountId })
  if (!row) throw new AffiliateError('AFFILIATE_NOT_FOUND', 'Affiliate not found')
  if (row.discountId) {
    await tx
      .update(discount)
      .set({ value: p.rules.coupon.bp, updatedAt: new Date() })
      .where(and(eq(discount.id, row.discountId), eq(discount.storeId, storeId)))
  }
}

/** Gives one affiliate their own default rate (null goes back to the program's). */
export async function setAffiliateRate(
  tx: StoreTx,
  affiliateId: string,
  rule: CommissionRule | null,
): Promise<void> {
  const rateOverride = rule ? CommissionRuleSchema.parse(rule) : null
  const [row] = await tx
    .update(affiliate)
    .set({ rateOverride, updatedAt: new Date() })
    .where(eq(affiliate.id, affiliateId))
    .returning({ id: affiliate.id })
  if (!row) throw new AffiliateError('AFFILIATE_NOT_FOUND', 'Affiliate not found')
}

/**
 * Archives a program: it takes no more signups and its affiliates move to `moveToId` (codes
 * take that program's discount). The default program cannot be archived.
 */
export async function archiveProgram(
  tx: StoreTx,
  storeId: string,
  id: string,
  moveToId: string,
): Promise<{ moved: number }> {
  const p = await getProgram(tx, id)
  if (!p) throw new AffiliateError('PROGRAM_NOT_FOUND', 'Program not found')
  if (p.isDefault) throw new AffiliateError('PROGRAM_DEFAULT', 'The default program stays open')
  if (moveToId === id) throw new AffiliateError('PROGRAM_MOVE', 'Pick another program')
  const target = await getProgram(tx, moveToId)
  if (!target || target.archivedAt) {
    throw new AffiliateError('PROGRAM_NOT_FOUND', 'Program not found')
  }
  const members = await tx
    .select({ id: affiliate.id })
    .from(affiliate)
    .where(eq(affiliate.programId, id))
  for (const m of members) await setAffiliateProgram(tx, storeId, m.id, target.id)
  await tx
    .update(affiliateProgram)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(affiliateProgram.id, id))
  return { moved: members.length }
}

/** Opens an archived program again. */
export async function restoreProgram(tx: StoreTx, id: string): Promise<void> {
  await tx
    .update(affiliateProgram)
    .set({ archivedAt: null, updatedAt: new Date() })
    .where(eq(affiliateProgram.id, id))
}
