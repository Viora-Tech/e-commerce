import { type DiscountInput, discountType, normaliseCode } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { discount, discountUsage } from '@commerce/db'
import { and, count, desc, eq, gte, ilike, isNotNull, isNull, lte, or, sql } from 'drizzle-orm'

const DAY_MS = 86_400_000

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
  usedCount: number
  usageLimit: number | null
  startsAt: Date | null
  endsAt: Date | null
  status: 'active' | 'disabled'
  lifecycle: DiscountLifecycle
  createdAt: Date
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

export async function listDiscounts(
  tx: StoreTx,
  input: {
    page: number
    perPage: number
    search?: string | undefined
    lifecycle?: DiscountLifecycle | undefined
  },
  now = new Date(),
): Promise<{ items: DiscountListItem[]; total: number }> {
  const where = and(
    input.search
      ? or(ilike(discount.title, `%${input.search}%`), ilike(discount.code, `%${input.search}%`))
      : undefined,
    lifecycleWhere(input.lifecycle, now),
  )
  const [countRow] = await tx.select({ total: count() }).from(discount).where(where)
  const rows = await tx
    .select()
    .from(discount)
    .where(where)
    .orderBy(desc(discount.createdAt))
    .limit(input.perPage)
    .offset((input.page - 1) * input.perPage)
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
      usedCount: r.usedCount,
      usageLimit: r.usageLimit,
      startsAt: r.startsAt,
      endsAt: r.endsAt,
      status: r.status,
      lifecycle: lifecycleOf(r, now),
      createdAt: r.createdAt,
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
  const [usage] = await tx
    .select({
      orders: count(),
      amountPaise: sql<number>`coalesce(sum(${discountUsage.amountPaise}), 0)::int`,
    })
    .from(discountUsage)
    .where(eq(discountUsage.discountId, id))
  return {
    ...row,
    lifecycle: lifecycleOf(row),
    usage: { orders: usage?.orders ?? 0, amountPaise: usage?.amountPaise ?? 0 },
  }
}

/** The per-product map to store: only for product-scoped percent or fixed discounts. */
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
    // A per-product discount keeps its amounts in product_values; the single value is unused.
    value: input.method === 'free_shipping' || productValues ? 0 : input.value,
    minSubtotalPaise: input.minSubtotalPaise ?? null,
    minQuantity: input.minQuantity ?? null,
    appliesTo: input.appliesTo,
    appliesToIds: input.appliesTo === 'all' ? [] : input.appliesToIds,
    productValues,
    type,
    bxgy: type === 'bxgy' ? (input.bxgy ?? null) : null,
    shippingStates: type === 'shipping' ? input.shippingStates : [],
    maxShippingPaise: type === 'shipping' ? (input.maxShippingPaise ?? null) : null,
    customerEligibility: input.customerEligibility,
    eligibleIds: input.customerEligibility === 'all' ? [] : input.eligibleIds,
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
