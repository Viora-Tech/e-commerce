import { type DiscountInput, discountType, normaliseCode } from '@commerce/core'
import type {
  DiscountBxgy,
  DiscountCombinesWith,
  DiscountCombo,
  DiscountEligibility,
  DiscountType,
  StoreTx,
} from '@commerce/db'
import { discount, discountUsage, order } from '@commerce/db'
import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  max,
  or,
  sql,
} from 'drizzle-orm'

const DAY_MS = 86_400_000
const RECENT_USES = 10

/**
 * What a discount has done, from its `discount_usage` rows (one per order that used it):
 * the orders, what they brought in and what the discount gave away, and the last use.
 * Test orders are left out; a cancelled order still counts as a use (it took one of the
 * limit) but adds nothing to revenue or the amount given.
 */
export type DiscountUsageSummary = {
  orders: number
  revenuePaise: number
  amountPaise: number
  lastUsedAt: Date | null
}

const EMPTY_USAGE: DiscountUsageSummary = {
  orders: 0,
  revenuePaise: 0,
  amountPaise: 0,
  lastUsedAt: null,
}

const kept = sql`${order.status} <> 'cancelled'`

/** Usage per discount for the ids given (a list page, or one discount). */
async function usageOf(tx: StoreTx, ids: string[]): Promise<Map<string, DiscountUsageSummary>> {
  const byId = new Map<string, DiscountUsageSummary>()
  if (ids.length === 0) return byId
  const rows = await tx
    .select({
      discountId: discountUsage.discountId,
      orders: count(),
      revenuePaise:
        sql<number>`coalesce(sum(${order.totalPaise}) filter (where ${kept}), 0)::bigint`.mapWith(
          Number,
        ),
      amountPaise:
        sql<number>`coalesce(sum(${discountUsage.amountPaise}) filter (where ${kept}), 0)::bigint`.mapWith(
          Number,
        ),
      lastUsedAt: max(discountUsage.createdAt),
    })
    .from(discountUsage)
    .innerJoin(order, eq(order.id, discountUsage.orderId))
    .where(and(inArray(discountUsage.discountId, ids), eq(order.isTest, false)))
    .groupBy(discountUsage.discountId)
  for (const r of rows) {
    byId.set(r.discountId, {
      orders: r.orders,
      revenuePaise: r.revenuePaise,
      amountPaise: r.amountPaise,
      lastUsedAt: r.lastUsedAt,
    })
  }
  await addImportedUsage(tx, ids, byId)
  return byId
}

/**
 * Orders brought over from another platform carry the code they used (`discount_code`, several
 * joined by commas) but no `discount_usage` row, so a code's revenue read ₹0 however often it
 * was used there (#994). They are added here, matched by code; the amount given is the order's
 * whole discount.
 */
async function addImportedUsage(
  tx: StoreTx,
  ids: string[],
  byId: Map<string, DiscountUsageSummary>,
): Promise<void> {
  const codes = await tx
    .select({ id: discount.id, code: discount.code })
    .from(discount)
    .where(and(inArray(discount.id, ids), isNotNull(discount.code)))
  const idByCode = new Map(codes.flatMap((c) => (c.code ? [[c.code.toUpperCase(), c.id]] : [])))
  if (idByCode.size === 0) return
  const used = sql`string_to_array(upper(replace(${order.discountCode}, ' ', '')), ',')`
  const rows = await tx
    .select({
      code: sql<string>`c.code`,
      orders: count(),
      revenuePaise:
        sql<number>`coalesce(sum(${order.totalPaise}) filter (where ${kept}), 0)::bigint`.mapWith(
          Number,
        ),
      amountPaise:
        sql<number>`coalesce(sum(${order.discountPaise}) filter (where ${kept}), 0)::bigint`.mapWith(
          Number,
        ),
      lastUsedAt: max(order.placedAt),
    })
    .from(order)
    .innerJoin(
      sql`unnest(${sql.param([...idByCode.keys()])}::text[]) as c(code)`,
      sql`c.code = any(${used})`,
    )
    .where(
      and(isNotNull(order.importedFrom), isNotNull(order.discountCode), eq(order.isTest, false)),
    )
    .groupBy(sql`c.code`)
  for (const r of rows) {
    const id = idByCode.get(r.code)
    if (!id) continue
    const now = byId.get(id) ?? EMPTY_USAGE
    const last =
      now.lastUsedAt && r.lastUsedAt
        ? new Date(Math.max(now.lastUsedAt.getTime(), new Date(r.lastUsedAt).getTime()))
        : (now.lastUsedAt ?? (r.lastUsedAt ? new Date(r.lastUsedAt) : null))
    byId.set(id, {
      orders: now.orders + r.orders,
      revenuePaise: now.revenuePaise + r.revenuePaise,
      amountPaise: now.amountPaise + r.amountPaise,
      lastUsedAt: last,
    })
  }
}

/**
 * The latest orders that used a discount, newest first, for its detail page. No customer
 * details: a discount reader may not see customers; the order link shows them to those who can.
 */
async function recentUses(tx: StoreTx, id: string) {
  return tx
    .select({
      orderId: order.id,
      number: order.number,
      status: order.status,
      totalPaise: order.totalPaise,
      amountPaise: discountUsage.amountPaise,
      usedAt: discountUsage.createdAt,
    })
    .from(discountUsage)
    .innerJoin(order, eq(order.id, discountUsage.orderId))
    .where(and(eq(discountUsage.discountId, id), eq(order.isTest, false)))
    .orderBy(desc(discountUsage.createdAt))
    .limit(RECENT_USES)
}

/** Where a discount is in its life right now; derived, not stored. */
export type DiscountLifecycle = 'active' | 'scheduled' | 'expired' | 'disabled'

export type DiscountListItem = {
  id: string
  title: string
  kind: 'code' | 'automatic'
  code: string | null
  method: 'percent' | 'fixed' | 'free_shipping'
  value: number
  appliesTo: 'all' | 'products' | 'collections'
  /** Set when the discount takes a different amount off each product. */
  productValues: Record<string, number> | null
  type: DiscountType
  /** Combo deal: its combos, for the Value column ("3 combos"); null for other types. */
  combos: DiscountCombo[] | null
  /** How many products or collections `appliesTo` narrows to (0 for `all`). */
  appliesToCount: number
  minSubtotalPaise: number | null
  minQuantity: number | null
  /** Buy X get Y settings, for the list's one-line summary; null for other types. */
  bxgy: DiscountBxgy | null
  /** Free shipping: how many states it is limited to (0 = every state) and its rate cap. */
  shippingStateCount: number
  maxShippingPaise: number | null
  customerEligibility: DiscountEligibility
  /** Segments or customers picked, per `customerEligibility`. */
  eligibleCount: number
  combinesWith: DiscountCombinesWith
  usagePerCustomer: number | null
  usedCount: number
  usageLimit: number | null
  startsAt: Date | null
  endsAt: Date | null
  status: 'active' | 'disabled'
  lifecycle: DiscountLifecycle
  createdAt: Date
  usage: DiscountUsageSummary
}

export type DiscountStats = {
  active: number
  scheduled: number
  expired: number
  usedThisMonth: number
}

export function lifecycleOf(
  d: { status: string; startsAt: Date | null; endsAt: Date | null },
  now = new Date(),
): DiscountLifecycle {
  if (d.status !== 'active') return 'disabled'
  if (d.startsAt && d.startsAt > now) return 'scheduled'
  if (d.endsAt && d.endsAt < now) return 'expired'
  return 'active'
}

function lifecycleWhere(lifecycle: DiscountLifecycle | undefined, now: Date) {
  const iso = now.toISOString()
  switch (lifecycle) {
    case 'active':
      return and(
        eq(discount.status, 'active'),
        or(isNull(discount.startsAt), lte(discount.startsAt, sql`${iso}::timestamptz`)),
        or(isNull(discount.endsAt), gte(discount.endsAt, sql`${iso}::timestamptz`)),
      )
    case 'scheduled':
      return and(eq(discount.status, 'active'), sql`${discount.startsAt} > ${iso}::timestamptz`)
    case 'expired':
      return and(
        eq(discount.status, 'active'),
        isNotNull(discount.endsAt),
        sql`${discount.endsAt} < ${iso}::timestamptz`,
      )
    case 'disabled':
      return eq(discount.status, 'disabled')
    default:
      return undefined
  }
}

/** The list's filter panel; arrays are "any of", each part combines with the others. */
export type DiscountListFilters = {
  lifecycles?: DiscountLifecycle[] | undefined
  types?: DiscountType[] | undefined
  kinds?: ('code' | 'automatic')[] | undefined
  /** Runs at some point in [from, to); ISO times. */
  activeFrom?: string | undefined
  activeTo?: string | undefined
  usedMin?: number | undefined
  usedMax?: number | undefined
  limitReached?: boolean | undefined
}

function filtersWhere(f: DiscountListFilters, now: Date) {
  const limitReached = and(
    isNotNull(discount.usageLimit),
    gte(discount.usedCount, discount.usageLimit),
  )
  return and(
    f.lifecycles?.length ? or(...f.lifecycles.map((l) => lifecycleWhere(l, now))) : undefined,
    f.types?.length ? inArray(discount.type, f.types) : undefined,
    f.kinds?.length ? inArray(discount.kind, f.kinds) : undefined,
    f.activeTo
      ? or(isNull(discount.startsAt), lt(discount.startsAt, new Date(f.activeTo)))
      : undefined,
    f.activeFrom
      ? or(isNull(discount.endsAt), gte(discount.endsAt, new Date(f.activeFrom)))
      : undefined,
    f.usedMin !== undefined ? gte(discount.usedCount, f.usedMin) : undefined,
    f.usedMax !== undefined ? lte(discount.usedCount, f.usedMax) : undefined,
    f.limitReached === undefined
      ? undefined
      : f.limitReached
        ? limitReached
        : sql`not coalesce(${limitReached}, false)`,
  )
}

export async function listDiscounts(
  tx: StoreTx,
  input: {
    page: number
    perPage: number
    search?: string | undefined
    lifecycle?: DiscountLifecycle | undefined
  } & DiscountListFilters,
  now = new Date(),
): Promise<{ items: DiscountListItem[]; total: number }> {
  const where = and(
    input.search
      ? or(ilike(discount.title, `%${input.search}%`), ilike(discount.code, `%${input.search}%`))
      : undefined,
    lifecycleWhere(input.lifecycle, now),
    filtersWhere(input, now),
  )
  const [countRow] = await tx.select({ total: count() }).from(discount).where(where)
  const rows = await tx
    .select()
    .from(discount)
    .where(where)
    .orderBy(desc(discount.createdAt))
    .limit(input.perPage)
    .offset((input.page - 1) * input.perPage)
  const usage = await usageOf(
    tx,
    rows.map((r) => r.id),
  )
  return {
    total: countRow?.total ?? 0,
    items: rows.map((r) => ({
      id: r.id,
      title: r.title,
      kind: r.kind,
      code: r.code,
      method: r.method,
      value: r.value,
      appliesTo: r.appliesTo,
      productValues: r.productValues,
      type: r.type,
      combos: r.combos,
      appliesToCount: r.appliesTo === 'all' ? 0 : r.appliesToIds.length,
      minSubtotalPaise: r.minSubtotalPaise,
      minQuantity: r.minQuantity,
      bxgy: r.bxgy,
      shippingStateCount: r.shippingStates.length,
      maxShippingPaise: r.maxShippingPaise,
      customerEligibility: r.customerEligibility,
      eligibleCount: listsIds(r.customerEligibility) ? r.eligibleIds.length : 0,
      combinesWith: r.combinesWith,
      usagePerCustomer: r.usagePerCustomer,
      usedCount: r.usedCount,
      usageLimit: r.usageLimit,
      startsAt: r.startsAt,
      endsAt: r.endsAt,
      status: r.status,
      lifecycle: lifecycleOf(r, now),
      createdAt: r.createdAt,
      usage: usage.get(r.id) ?? EMPTY_USAGE,
    })),
  }
}

export async function discountStats(tx: StoreTx, now = new Date()): Promise<DiscountStats> {
  const monthAgo = new Date(now.getTime() - 30 * DAY_MS)
  const [counts, used] = await Promise.all([
    tx
      .select({
        active: sql<number>`count(*) filter (where ${lifecycleWhere('active', now)})::int`,
        scheduled: sql<number>`count(*) filter (where ${lifecycleWhere('scheduled', now)})::int`,
        expired: sql<number>`count(*) filter (where ${lifecycleWhere('expired', now)})::int`,
      })
      .from(discount),
    tx.select({ n: count() }).from(discountUsage).where(gte(discountUsage.createdAt, monthAgo)),
  ])
  const c = counts[0]
  return {
    active: c?.active ?? 0,
    scheduled: c?.scheduled ?? 0,
    expired: c?.expired ?? 0,
    usedThisMonth: used[0]?.n ?? 0,
  }
}

export async function getDiscount(tx: StoreTx, id: string) {
  const [row] = await tx.select().from(discount).where(eq(discount.id, id))
  if (!row) return null
  const [usage, recent] = await Promise.all([usageOf(tx, [id]), recentUses(tx, id)])
  return {
    ...row,
    lifecycle: lifecycleOf(row),
    usage: { ...(usage.get(id) ?? EMPTY_USAGE), recent },
  }
}

/** The per-product map to store: only for product-scoped percent or fixed discounts. */
/** Segments and specific customers keep their picked ids; everyone and first-time buyers none. */
const listsIds = (e: DiscountEligibility): boolean => e === 'segments' || e === 'customers'

function productValuesOf(input: DiscountInput): Record<string, number> | null {
  if (input.appliesTo !== 'products' || input.method === 'free_shipping') return null
  const map = input.productValues
  if (!map || Object.keys(map).length === 0) return null
  const chosen = new Set(input.appliesToIds)
  return Object.fromEntries(Object.entries(map).filter(([id]) => chosen.has(id)))
}

function toRow(storeId: string, input: DiscountInput) {
  const productValues = productValuesOf(input)
  const type = discountType(input)
  return {
    storeId,
    title: input.title,
    kind: input.kind,
    code: input.kind === 'code' && input.code ? normaliseCode(input.code) : null,
    method: input.method,
    // A per-product discount keeps its amounts in product_values and a combo deal on each
    // combo; the single value is unused.
    value: input.method === 'free_shipping' || productValues || type === 'combo' ? 0 : input.value,
    minSubtotalPaise: input.minSubtotalPaise ?? null,
    minQuantity: input.minQuantity ?? null,
    appliesTo: input.appliesTo,
    appliesToIds: input.appliesTo === 'all' ? [] : input.appliesToIds,
    productValues,
    type,
    bxgy: type === 'bxgy' ? (input.bxgy ?? null) : null,
    combos: type === 'combo' ? (input.combos ?? null) : null,
    shippingStates: type === 'shipping' ? input.shippingStates : [],
    maxShippingPaise: type === 'shipping' ? (input.maxShippingPaise ?? null) : null,
    customerEligibility: input.customerEligibility,
    eligibleIds: listsIds(input.customerEligibility) ? input.eligibleIds : [],
    combinesWith: input.combinesWith,
    usageLimit: input.usageLimit ?? null,
    usagePerCustomer: input.usagePerCustomer ?? null,
    startsAt: input.startsAt ?? null,
    endsAt: input.endsAt ?? null,
    status: input.status,
    updatedAt: new Date(),
  }
}

export class DiscountCodeTaken extends Error {
  constructor(code: string) {
    super(`Code ${code} is already in use`)
    this.name = 'DiscountCodeTaken'
  }
}

async function assertCodeFree(tx: StoreTx, code: string | null, exceptId?: string) {
  if (!code) return
  const [clash] = await tx.select({ id: discount.id }).from(discount).where(eq(discount.code, code))
  if (clash && clash.id !== exceptId) throw new DiscountCodeTaken(code)
}

export async function createDiscount(tx: StoreTx, storeId: string, input: DiscountInput) {
  const row = toRow(storeId, input)
  await assertCodeFree(tx, row.code)
  const [created] = await tx.insert(discount).values(row).returning()
  return created ?? null
}

export async function updateDiscount(
  tx: StoreTx,
  storeId: string,
  id: string,
  input: DiscountInput,
) {
  const row = toRow(storeId, input)
  await assertCodeFree(tx, row.code, id)
  const [updated] = await tx.update(discount).set(row).where(eq(discount.id, id)).returning()
  return updated ?? null
}

export async function setDiscountStatus(tx: StoreTx, id: string, status: 'active' | 'disabled') {
  const [updated] = await tx
    .update(discount)
    .set({ status, updatedAt: new Date() })
    .where(eq(discount.id, id))
    .returning()
  return updated ?? null
}

/** Discounts with recorded usage are disabled rather than deleted so order history keeps its link. */
export async function deleteDiscount(
  tx: StoreTx,
  id: string,
): Promise<{ outcome: 'deleted' | 'disabled' } | null> {
  const [used] = await tx
    .select({ n: count() })
    .from(discountUsage)
    .where(eq(discountUsage.discountId, id))
  if ((used?.n ?? 0) > 0) {
    const row = await setDiscountStatus(tx, id, 'disabled')
    return row ? { outcome: 'disabled' } : null
  }
  const rows = await tx.delete(discount).where(eq(discount.id, id)).returning({ id: discount.id })
  return rows.length ? { outcome: 'deleted' } : null
}

/** A paused copy of a discount: "<title> (copy)", the code suffixed until free, no usage carried over. */
export async function duplicateDiscount(tx: StoreTx, id: string) {
  const [source] = await tx.select().from(discount).where(eq(discount.id, id))
  if (!source) return null
  let code: string | null = null
  if (source.code) {
    const base = `${source.code}-COPY`
    code = base
    for (let n = 2; ; n++) {
      const [clash] = await tx
        .select({ id: discount.id })
        .from(discount)
        .where(eq(discount.code, code))
      if (!clash) break
      code = `${base}${n}`
    }
  }
  const { id: _id, usedCount: _used, createdAt: _created, ...rest } = source
  const [created] = await tx
    .insert(discount)
    .values({
      ...rest,
      title: `${source.title} (copy)`,
      code,
      usedCount: 0,
      status: 'disabled',
      updatedAt: new Date(),
    })
    .returning()
  return created ?? null
}
