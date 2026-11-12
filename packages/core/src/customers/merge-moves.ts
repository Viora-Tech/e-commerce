/** SOURCE OF TRUTH: what a customer merge moves — WHAT: the row moves behind `mergeCustomers`: store credit through the store credit service, marketing consent per channel, and every table that points at a customer / WHY: kept beside `merge.ts` so the list of tables is one place to read when a new table gets a customer_id */
import {
  automationRun,
  cart,
  cookieConsent,
  type customer,
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
import { CONSENT_CHANNELS, CONSENT_FLAG } from '../privacy/client'
import { changeStoreCredit } from './store-credit'
import { lockStoreCreditBalance, openLots } from './store-credit-expiry'

type CustomerRow = typeof customer.$inferSelect

/** How a customer reads in timeline and store credit lines. */
export const labelOf = (c: Pick<CustomerRow, 'name' | 'email'>) =>
  c.name?.trim() || c.email || 'a customer'

/**
 * Store credit: the merged customer's balance goes through the store credit service, so both
 * ledgers stay true: one debit line on the merged record, and on the kept one a credit per piece
 * that still has an expiry date (keeping that date) plus one for the money that never expires.
 * The balances add up to the paisa; the kept balance's ₹2,00,000 cap still applies and refuses the
 * whole merge when crossed. Returns the amount moved.
 */
export async function moveStoreCredit(
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
export async function mergedConsent(ctx: StoreContext, kept: CustomerRow, merged: CustomerRow) {
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
export async function moveMergedRows(ctx: StoreContext, keptId: string, mergedId: string) {
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
