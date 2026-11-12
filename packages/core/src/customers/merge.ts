/** SOURCE OF TRUTH: customer merge — WHAT: `previewCustomerMerge` (what would move) and `mergeCustomers`, which moves everything one customer record holds onto another in one transaction (orders, addresses, store credit, gift cards, sign-in identities and passkeys, carts, notes, consent history, reviews, affiliate rows…) and leaves the other as an erased stub pointing at the kept one / WHY: one shopper can end up as two records (an order's email changed by staff, a second sign-in email), and their account then shows no orders; merging is the only way to make them one again without losing money or history */

import { customer, customerNote } from '@commerce/db'
import { formatMoney } from '@commerce/money'
import { asc, eq, inArray, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { type PrivacyActor, recordPrivacyEvent } from '../privacy/audit'
import { noteCustomerTagsChanged, recordCustomerChange } from './changes'
import { labelOf, mergedConsent, moveMergedRows, moveStoreCredit } from './merge-moves'

/** Which record's value the kept customer ends up with, per field. */
export type MergeChoice = 'kept' | 'merged'

export type MergeCustomersInput = {
  /** The customer that stays (its id, page and URL live on). */
  keepId: string
  /** The customer merged into it; left behind as an erased stub. */
  mergeId: string
  /** Whose email, phone and name the kept customer has afterwards; each defaults to `kept`. */
  keep?:
    | {
        email?: MergeChoice | undefined
        phone?: MergeChoice | undefined
        name?: MergeChoice | undefined
      }
    | undefined
  actor: PrivacyActor
  /** Staff email for the timelines and the store credit history. */
  author?: string | null | undefined
}

/** What moves from the merged customer onto the kept one, counted before anything is written. */
export type MergeCounts = {
  orders: number
  addresses: number
  storeCreditPaise: number
  giftCards: number
  identities: number
  passkeys: number
  carts: number
  notes: number
  reviews: number
  conversations: number
}

export type MergeCustomerSummary = {
  id: string
  name: string | null
  email: string | null
  /** Whether a phone is on file; the number itself stays encrypted here. */
  hasPhone: boolean
  tags: string[]
}

export type MergeRefusal =
  | 'same'
  | 'not_found'
  /** Either record was erased, or already merged into someone. */
  | 'anonymised'

export type MergePreviewResult =
  | { ok: true; kept: MergeCustomerSummary; merged: MergeCustomerSummary; moves: MergeCounts }
  | { ok: false; reason: MergeRefusal }

export type MergeCustomersResult =
  | { ok: true; keptId: string; moved: MergeCounts }
  | { ok: false; reason: MergeRefusal }

type CustomerRow = typeof customer.$inferSelect

const summaryOf = (c: CustomerRow): MergeCustomerSummary => ({
  id: c.id,
  name: c.name,
  email: c.email,
  hasPhone: Boolean(c.phone),
  tags: c.tags,
})

/** Both records, locked in id order (two merges of the same pair never deadlock), or a refusal. */
async function bothCustomers(
  ctx: StoreContext,
  keepId: string,
  mergeId: string,
  lock: boolean,
): Promise<
  { ok: true; kept: CustomerRow; merged: CustomerRow } | { ok: false; reason: MergeRefusal }
> {
  if (keepId === mergeId) return { ok: false, reason: 'same' }
  const query = ctx.tx
    .select()
    .from(customer)
    .where(inArray(customer.id, [keepId, mergeId]))
    .orderBy(asc(customer.id))
  const rows = lock ? await query.for('update') : await query
  const kept = rows.find((r) => r.id === keepId)
  const merged = rows.find((r) => r.id === mergeId)
  if (!kept || !merged) return { ok: false, reason: 'not_found' }
  if (kept.anonymisedAt || merged.anonymisedAt || kept.mergedIntoId || merged.mergedIntoId) {
    return { ok: false, reason: 'anonymised' }
  }
  return { ok: true, kept, merged }
}

async function countMoves(ctx: StoreContext, id: string): Promise<MergeCounts> {
  const { tx, storeId } = ctx
  const n = (table: string) =>
    sql<number>`(select count(*)::int from ${sql.identifier(table)} where store_id = ${storeId} and customer_id = ${id})`
  const [row] = await tx.execute<Omit<MergeCounts, 'storeCreditPaise'>>(sql`select
    ${n('order')} as orders,
    ${n('customer_address')} as addresses,
    ${n('gift_card')} as "giftCards",
    ${n('customer_identity')} as identities,
    ${n('customer_passkey')} as passkeys,
    ${n('cart')} as carts,
    ${n('customer_note')} as notes,
    (${n('review')} + ${n('review_question')}) as reviews,
    ${n('inbox_conversation')} as conversations`)
  const balance = await tx.execute<{ paise: number }>(
    sql`select coalesce(sum(balance_paise), 0)::int as paise from store_credit_account where store_id = ${storeId} and customer_id = ${id}`,
  )
  return {
    orders: Number(row?.orders ?? 0),
    addresses: Number(row?.addresses ?? 0),
    storeCreditPaise: Number(balance[0]?.paise ?? 0),
    giftCards: Number(row?.giftCards ?? 0),
    identities: Number(row?.identities ?? 0),
    passkeys: Number(row?.passkeys ?? 0),
    carts: Number(row?.carts ?? 0),
    notes: Number(row?.notes ?? 0),
    reviews: Number(row?.reviews ?? 0),
    conversations: Number(row?.conversations ?? 0),
  }
}

/** Both customers and what would move, for the merge dialog. Writes nothing. */
export async function previewCustomerMerge(
  ctx: StoreContext,
  keepId: string,
  mergeId: string,
): Promise<MergePreviewResult> {
  const found = await bothCustomers(ctx, keepId, mergeId, false)
  if (!found.ok) return found
  return {
    ok: true,
    kept: summaryOf(found.kept),
    merged: summaryOf(found.merged),
    moves: await countMoves(ctx, mergeId),
  }
}

/** Case-insensitively unique tags, the kept customer's first. */
function unionTags(a: readonly string[], b: readonly string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const tag of [...a, ...b]) {
    if (seen.has(tag.toLowerCase())) continue
    seen.add(tag.toLowerCase())
    out.push(tag)
  }
  return out.slice(0, 50)
}

/**
 * Merge `mergeId` into `keepId`, in the caller's transaction (one transaction: all of it or
 * none). Everything the merged record holds moves to the kept one (see `moveMergedRows` and the PR's
 * table list), store credit through the store credit service. The kept customer takes the email,
 * phone and name chosen in `keep`, both records' tags, their note added under its own, and any
 * GSTIN or address snapshot it lacked. The merged record stays as an erased stub
 * (`anonymised_at`, `merged_into_id`), so its own store credit lines and privacy audit entries
 * keep an owner; its sessions end. Both timelines get a line, the privacy audit trail an entry,
 * and installed apps hear `customer.updated` for the kept one.
 *
 * Refused (nothing written): the same customer twice, either not found, or either erased or
 * already merged.
 */
export async function mergeCustomers(
  ctx: StoreContext,
  input: MergeCustomersInput,
  now: Date = new Date(),
): Promise<MergeCustomersResult> {
  const found = await bothCustomers(ctx, input.keepId, input.mergeId, true)
  if (!found.ok) return found
  const { kept, merged } = found
  const moved = await countMoves(ctx, merged.id)
  const author = input.author ?? null
  // The chosen record's value, or the other's when the chosen one has none.
  const source = (field: 'email' | 'phone' | 'name') => {
    const want = input.keep?.[field] === 'merged' ? merged : kept
    const other = want === kept ? merged : kept
    return want[field] ? want : other
  }
  const phoneFrom = source('phone')
  const next = {
    email: source('email').email,
    name: source('name').name,
    phone: phoneFrom.phone,
    phoneIndex: phoneFrom.phoneIndex,
    phoneVerifiedAt: phoneFrom.phoneVerifiedAt,
  }

  moved.storeCreditPaise = await moveStoreCredit(
    ctx,
    kept,
    merged,
    { userId: input.actor.id ?? null, email: author },
    now,
  )
  const consent = await mergedConsent(ctx, kept, merged)
  await moveMergedRows(ctx, kept.id, merged.id)

  // The stub first: the email is unique per store, so it leaves the merged record before the
  // kept one can take it.
  await ctx.tx
    .update(customer)
    .set({
      email: null,
      phone: null,
      phoneIndex: null,
      phoneVerifiedAt: null,
      name: null,
      gstin: null,
      businessName: null,
      defaultAddress: null,
      tags: [],
      note: null,
      acceptsMarketing: false,
      acceptsWhatsapp: false,
      acceptsSms: false,
      marketingConsentSource: null,
      unsubscribedAt: now,
      anonymisedAt: now,
      mergedIntoId: kept.id,
      updatedAt: now,
    })
    .where(eq(customer.id, merged.id))
  const tags = unionTags(kept.tags, merged.tags)
  const note = [kept.note?.trim(), merged.note?.trim()].filter(Boolean).join('\n\n') || null
  await ctx.tx
    .update(customer)
    .set({
      ...next,
      ...consent,
      tags,
      note: note ? note.slice(0, 2000) : null,
      gstin: kept.gstin ?? merged.gstin,
      businessName: kept.gstin ? kept.businessName : (merged.businessName ?? kept.businessName),
      defaultAddress: kept.defaultAddress ?? merged.defaultAddress,
      updatedAt: now,
    })
    .where(eq(customer.id, kept.id))

  const facts = [
    moved.orders > 0 ? `${moved.orders} order${moved.orders === 1 ? '' : 's'}` : null,
    moved.addresses > 0 ? `${moved.addresses} address${moved.addresses === 1 ? '' : 'es'}` : null,
    moved.storeCreditPaise > 0 ? `${formatMoney(moved.storeCreditPaise)} store credit` : null,
  ].filter(Boolean)
  const what = facts.length > 0 ? `: ${facts.join(', ')} moved here` : ''
  await ctx.tx.insert(customerNote).values([
    {
      storeId: ctx.storeId,
      customerId: kept.id,
      body: `Merged with ${labelOf(merged)}${what}`,
      author,
      createdAt: now,
    },
    {
      storeId: ctx.storeId,
      customerId: merged.id,
      body: `Merged into ${labelOf({ name: next.name, email: next.email })}; this record was closed`,
      author,
      createdAt: now,
    },
  ])
  for (const [id, other, role] of [
    [kept.id, merged.id, 'kept'],
    [merged.id, kept.id, 'merged'],
  ] as const) {
    await recordPrivacyEvent(ctx, {
      action: 'customer.merged',
      actor: input.actor,
      customerId: id,
      detail: { role, otherCustomerId: other, ...moved },
      at: now,
    })
  }
  await noteCustomerTagsChanged(ctx.tx, ctx.storeId, kept.id, kept.tags, tags)
  await recordCustomerChange(ctx.tx, ctx.storeId, kept.id, 'updated')
  return { ok: true, keptId: kept.id, moved }
}
