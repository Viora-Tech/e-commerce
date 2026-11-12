/** SOURCE OF TRUTH: customer merge — WHAT: `previewCustomerMerge` (what would move) and `mergeCustomers`, which moves everything one customer record holds onto another in one transaction (orders, addresses, store credit, gift cards, sign-in identities and passkeys, carts, notes, consent history, reviews, affiliate rows…) and leaves the other as an erased stub pointing at the kept one / WHY: one shopper can end up as two records (an order's email changed by staff, a second sign-in email), and their account then shows no orders; merging is the only way to make them one again without losing money or history */
import {
  automationRun,
  cart,
  cookieConsent,
  customer,
  customerAddress,
  customerIdentity,
  customerLoginTicket,
  customerNote,
  customerOtp,
  customerPasskey,
  customerSession,
  dataRequest,
  discountUsage,
  giftCard,
  inboxConversation,
  marketingAutomationRun,
  marketingConsentEvent,
  marketingMessage,
  metafield,
  order,
  productView,
  storeCreditEntry,
} from '@commerce/db'
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { type PrivacyActor, recordPrivacyEvent } from '../privacy/audit'
import { CONSENT_CHANNELS, CONSENT_FLAG } from '../privacy/client'
import { noteCustomerTagsChanged, recordCustomerChange } from './changes'
import { changeStoreCredit } from './store-credit'
import { lockStoreCreditBalance, openLots } from './store-credit-expiry'

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

const labelOf = (c: Pick<CustomerRow, 'name' | 'email'>) =>
  c.name?.trim() || c.email || 'a customer'

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
 * Store credit: the merged customer's balance goes through the store credit service, so both
 * ledgers stay true: one debit line on the merged record, and on the kept one a credit per piece
 * that still has an expiry date (keeping that date) plus one for the money that never expires.
 * The balances add up to the paisa; the kept balance's ₹2,00,000 cap still applies and refuses the
 * whole merge when crossed. Returns the amount moved.
 */
async function moveStoreCredit(
  ctx: StoreContext,
  kept: CustomerRow,
  merged: CustomerRow,
  staff: { userId: string | null; email: string | null },
  now: Date,
): Promise<number> {
  const balance = await lockStoreCreditBalance(ctx, merged.id, now)
  if (balance <= 0) return 0
  const ledger = await ctx.tx
    .select({
      id: storeCreditEntry.id,
      amountPaise: storeCreditEntry.amountPaise,
      kind: storeCreditEntry.kind,
      expiresAt: storeCreditEntry.expiresAt,
      expiredEntryId: storeCreditEntry.expiredEntryId,
    })
    .from(storeCreditEntry)
    .where(eq(storeCreditEntry.customerId, merged.id))
    .orderBy(asc(storeCreditEntry.id))
  const lots = openLots(ledger)
    .filter((l) => l.expiresAt.getTime() > now.getTime())
    .sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime())
  await changeStoreCredit(
    ctx,
    {
      customerId: merged.id,
      amountPaise: -balance,
      kind: 'adjustment',
      reason: `Moved to ${labelOf(kept)} (customers merged)`,
      staff,
    },
    now,
  )
  let left = balance
  const reason = `Moved from ${labelOf(merged)} (customers merged)`
  for (const lot of lots) {
    const amount = Math.min(lot.remainingPaise, left)
    if (amount <= 0) continue
    left -= amount
    await changeStoreCredit(
      ctx,
      {
        customerId: kept.id,
        amountPaise: amount,
        kind: 'adjustment',
        reason,
        staff,
        expiresAt: lot.expiresAt,
      },
      now,
    )
  }
  if (left > 0) {
    await changeStoreCredit(
      ctx,
      { customerId: kept.id, amountPaise: left, kind: 'adjustment', reason, staff },
      now,
    )
  }
  return balance
}

/**
 * Marketing consent per channel after the merge: the most recent recorded choice on either
 * record wins (both histories are now the kept customer's); with no history on that channel
 * the kept customer's flag stays. An unsubscribe stays unless a later opt in replaced it.
 */
async function mergedConsent(ctx: StoreContext, kept: CustomerRow, merged: CustomerRow) {
  const events = await ctx.tx
    .select({
      channel: marketingConsentEvent.channel,
      granted: marketingConsentEvent.granted,
      source: marketingConsentEvent.source,
      createdAt: marketingConsentEvent.createdAt,
    })
    .from(marketingConsentEvent)
    .where(inArray(marketingConsentEvent.customerId, [kept.id, merged.id]))
    .orderBy(desc(marketingConsentEvent.createdAt), desc(marketingConsentEvent.id))
  const flags = {
    acceptsMarketing: kept.acceptsMarketing,
    acceptsWhatsapp: kept.acceptsWhatsapp,
    acceptsSms: kept.acceptsSms,
  }
  for (const channel of CONSENT_CHANNELS) {
    const latest = events.find((e) => e.channel === channel)
    if (latest) flags[CONSENT_FLAG[channel] as keyof typeof flags] = latest.granted
  }
  const latestGrant = events.find((e) => e.granted)
  const unsubscribed = [kept.unsubscribedAt, merged.unsubscribedAt]
    .filter((d): d is Date => d !== null)
    .sort((a, b) => b.getTime() - a.getTime())[0]
  const unsubscribedAt =
    unsubscribed && !(latestGrant && latestGrant.createdAt > unsubscribed) ? unsubscribed : null
  const consentAt = [kept, merged]
    .filter((c) => c.marketingConsentAt)
    .sort(
      (a, b) => (b.marketingConsentAt?.getTime() ?? 0) - (a.marketingConsentAt?.getTime() ?? 0),
    )[0]
  return {
    ...flags,
    unsubscribedAt,
    marketingConsentAt: consentAt?.marketingConsentAt ?? null,
    marketingConsentSource: consentAt?.marketingConsentSource ?? null,
  }
}

/** Moves every row that belongs to the merged customer onto the kept one. */
async function moveRows(ctx: StoreContext, keptId: string, mergedId: string) {
  const { tx, storeId } = ctx
  const to = { customerId: keptId }
  // Address book: the kept customer's defaults win; theirs join as plain saved addresses.
  const [keptDefaults] = await tx
    .select({
      shipping: sql<boolean>`bool_or(${customerAddress.isDefault})`,
      billing: sql<boolean>`bool_or(${customerAddress.isDefaultBilling})`,
    })
    .from(customerAddress)
    .where(eq(customerAddress.customerId, keptId))
  await tx
    .update(customerAddress)
    .set({
      customerId: keptId,
      ...(keptDefaults?.shipping ? { isDefault: false } : {}),
      ...(keptDefaults?.billing ? { isDefaultBilling: false } : {}),
    })
    .where(eq(customerAddress.customerId, mergedId))

  await tx.update(order).set(to).where(eq(order.customerId, mergedId))
  await tx.update(cart).set(to).where(eq(cart.customerId, mergedId))
  await tx.update(giftCard).set(to).where(eq(giftCard.customerId, mergedId))
  await tx.update(discountUsage).set(to).where(eq(discountUsage.customerId, mergedId))
  await tx.update(customerNote).set(to).where(eq(customerNote.customerId, mergedId))
  await tx.update(inboxConversation).set(to).where(eq(inboxConversation.customerId, mergedId))
  await tx
    .update(marketingConsentEvent)
    .set(to)
    .where(eq(marketingConsentEvent.customerId, mergedId))
  await tx.update(marketingMessage).set(to).where(eq(marketingMessage.customerId, mergedId))
  await tx
    .update(marketingAutomationRun)
    .set(to)
    .where(eq(marketingAutomationRun.customerId, mergedId))
  await tx.update(automationRun).set(to).where(eq(automationRun.customerId, mergedId))
  await tx.update(cookieConsent).set(to).where(eq(cookieConsent.customerId, mergedId))
  await tx.update(dataRequest).set(to).where(eq(dataRequest.customerId, mergedId))
  // Sign-in: their Google, Apple, Facebook and Truecaller links and passkeys now open the kept
  // account. Sessions, pending codes and tickets of the merged record end here.
  await tx.update(customerIdentity).set(to).where(eq(customerIdentity.customerId, mergedId))
  await tx.update(customerPasskey).set(to).where(eq(customerPasskey.customerId, mergedId))
  await tx.delete(customerSession).where(eq(customerSession.customerId, mergedId))
  await tx.delete(customerOtp).where(eq(customerOtp.customerId, mergedId))
  await tx.delete(customerLoginTicket).where(eq(customerLoginTicket.customerId, mergedId))

  // Browse history: one row per product, so a product both looked at keeps the later look.
  await tx.execute(sql`
    update product_view k set viewed_at = greatest(k.viewed_at, m.viewed_at)
    from product_view m
    where k.store_id = ${storeId} and m.store_id = ${storeId}
      and k.customer_id = ${keptId} and m.customer_id = ${mergedId} and k.product_id = m.product_id`)
  await tx.execute(sql`
    delete from product_view m where m.store_id = ${storeId} and m.customer_id = ${mergedId}
      and exists (select 1 from product_view k where k.store_id = ${storeId}
        and k.customer_id = ${keptId} and k.product_id = m.product_id)`)
  await tx.update(productView).set(to).where(eq(productView.customerId, mergedId))

  // Extra fields: the kept customer's value wins where both have one.
  await tx.execute(sql`
    delete from ${metafield} m where m.store_id = ${storeId} and m.owner_type = 'customer'
      and m.owner_id = ${mergedId}
      and exists (select 1 from ${metafield} k where k.owner_type = 'customer'
        and k.owner_id = ${keptId} and k.definition_id = m.definition_id)`)
  await tx
    .update(metafield)
    .set({ ownerId: keptId })
    .where(and(eq(metafield.ownerType, 'customer'), eq(metafield.ownerId, mergedId)))

  // Discounts limited to named customers: the merged one's place goes to the kept one.
  await tx.execute(sql`
    update discount set eligible_ids = (
      select coalesce(jsonb_agg(distinct v), '[]'::jsonb) from (
        select case when e = ${mergedId} then ${keptId} else e end as v
        from jsonb_array_elements_text(eligible_ids) e) x),
      updated_at = now()
    where store_id = ${storeId} and eligible_ids ? ${mergedId}`)

  // App tables (Reviews, Affiliates), by name as the erasure does: core does not depend on the
  // plugin packages, and the core migrations create them.
  await tx.execute(
    sql`update review set customer_id = ${keptId} where store_id = ${storeId} and customer_id = ${mergedId}`,
  )
  await tx.execute(
    sql`update review_question set customer_id = ${keptId} where store_id = ${storeId} and customer_id = ${mergedId}`,
  )
  await tx.execute(
    sql`update affiliate_commission set customer_id = ${keptId} where store_id = ${storeId} and customer_id = ${mergedId}`,
  )
  // One affiliate record per customer: theirs moves only when the kept customer has none;
  // otherwise it stays as it is, without the account link.
  await tx.execute(sql`
    update affiliate set customer_id = case
        when exists (select 1 from affiliate k where k.store_id = ${storeId} and k.customer_id = ${keptId})
        then null else ${keptId}::uuid end,
      updated_at = now()
    where store_id = ${storeId} and customer_id = ${mergedId}`)
}

/**
 * Merge `mergeId` into `keepId`, in the caller's transaction (one transaction: all of it or
 * none). Everything the merged record holds moves to the kept one (see `moveRows` and the PR's
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
  await moveRows(ctx, kept.id, merged.id)

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
    moved.storeCreditPaise > 0
      ? `₹${(moved.storeCreditPaise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })} store credit`
      : null,
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
