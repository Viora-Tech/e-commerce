/** SOURCE OF TRUTH: review and birthday points — WHAT: which published reviews and which birthdays earn points (once per product, once a year; the points from the store's `product_review` and `birthday` rules, or the v1 settings before rules exist) as pending entries the sweep credits straight away, and setting a customer's birthday / WHY: the unique indexes on `loyalty_entry` make each grant happen once even when the sweep runs twice or overlaps */
import { dayKey } from '@commerce/dates'
import { customer, loyaltyEntry } from '@commerce/db'
import { and, eq, inArray, isNull, notExists, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { storeCreditTimeZone } from '../customers/store-credit-expiry'
import { canUseProgram, ensureMember } from './member'
import { rulePoints } from './rules'
import {
  birthdaysOn,
  type LoyaltySettings,
  normaliseBirthday,
  REVIEW_LOOKBACK_DAYS,
} from './settings'

const DAY_MS = 86_400_000

/** At most this many grants per kind per store per sweep; the next sweep takes the rest. */
const GRANT_BATCH = 200

/**
 * Review points: a review published on the store in the last `REVIEW_LOOKBACK_DAYS` days, by a
 * customer with a delivered order (not cancelled) holding that product, earns `reviewPoints`
 * once per customer and product. The `review` table is the Reviews app's; it is read by name,
 * as the customer merge does, since core does not depend on the app package. Returns how many
 * entries were made (pending, due now).
 */
export async function grantReviewPoints(
  ctx: StoreContext,
  settings: LoyaltySettings,
  now: Date = new Date(),
): Promise<number> {
  const { points, ruleId } = await rulePoints(ctx, 'product_review', settings.reviewPoints)
  if (points <= 0) return 0
  const since = new Date(now.getTime() - REVIEW_LOOKBACK_DAYS * DAY_MS)
  const rows = await ctx.tx.execute<{ customer_id: string; product_id: string; title: string }>(sql`
    select distinct on (r.customer_id, r.product_id) r.customer_id, r.product_id, p.title
    from review r
    join product p on p.id = r.product_id
    where r.store_id = ${ctx.storeId}
      and r.status = 'published'
      and r.source = 'storefront'
      and r.customer_id is not null
      and r.product_id is not null
      and r.published_at > ${since.toISOString()}::timestamptz
      and exists (
        select 1 from order_line ol
        join variant v on v.id = ol.variant_id
        join "order" o on o.id = ol.order_id
        where o.store_id = ${ctx.storeId}
          and o.customer_id = r.customer_id
          and v.product_id = r.product_id
          and o.status <> 'cancelled'
          and o.fulfillment_status in ('delivered', 'partially_delivered'))
      and not exists (
        select 1 from loyalty_entry le
        where le.store_id = ${ctx.storeId} and le.source = 'review'
          and le.customer_id = r.customer_id and le.product_id = r.product_id)
    limit ${GRANT_BATCH}`)
  let made = 0
  for (const r of rows) {
    if (!(await canUseProgram(ctx, r.customer_id, settings))) continue
    await ensureMember(ctx, r.customer_id, now)
    const [row] = await ctx.tx
      .insert(loyaltyEntry)
      .values({
        storeId: ctx.storeId,
        customerId: r.customer_id,
        source: 'review',
        status: 'pending',
        points,
        ruleId,
        productId: r.product_id,
        reason: `Points for reviewing ${r.title}`.slice(0, 200),
        availableAt: now,
      })
      .onConflictDoNothing()
      .returning({ id: loyaltyEntry.id })
    if (row) made += 1
  }
  return made
}

/**
 * Birthday points: customers whose birthday is today in the store's time zone (29 Feb counts on
 * 28 Feb in other years) get `birthdayPoints`, once per calendar year. Erased and merged records
 * are left out. Returns how many entries were made (pending, due now).
 */
export async function grantBirthdayPoints(
  ctx: StoreContext,
  settings: LoyaltySettings,
  now: Date = new Date(),
): Promise<number> {
  const { points, ruleId } = await rulePoints(ctx, 'birthday', settings.birthdayPoints)
  if (points <= 0) return 0
  const today = dayKey(now, await storeCreditTimeZone(ctx))
  const year = Number(today.slice(0, 4))
  const due = await ctx.tx
    .select({ id: customer.id })
    .from(customer)
    .where(
      and(
        inArray(customer.birthday, birthdaysOn(today)),
        isNull(customer.anonymisedAt),
        isNull(customer.mergedIntoId),
        notExists(
          ctx.tx
            .select({ one: sql`1` })
            .from(loyaltyEntry)
            .where(
              and(
                eq(loyaltyEntry.customerId, customer.id),
                eq(loyaltyEntry.source, 'birthday'),
                eq(loyaltyEntry.year, year),
              ),
            ),
        ),
      ),
    )
    .limit(GRANT_BATCH)
  let made = 0
  for (const c of due) {
    if (!(await canUseProgram(ctx, c.id, settings))) continue
    await ensureMember(ctx, c.id, now)
    const [row] = await ctx.tx
      .insert(loyaltyEntry)
      .values({
        storeId: ctx.storeId,
        customerId: c.id,
        source: 'birthday',
        status: 'pending',
        points,
        ruleId,
        year,
        reason: `Birthday points ${year}`,
        availableAt: now,
      })
      .onConflictDoNothing()
      .returning({ id: loyaltyEntry.id })
    if (row) made += 1
  }
  return made
}

export type BirthdayResult =
  | { ok: true; birthday: string | null }
  | { ok: false; reason: 'invalid' | 'already_set' | 'not_found' }

/**
 * Sets a customer's birthday (`MM-DD`, or `YYYY-MM-DD` whose year is dropped). The shopper may
 * add it once (`by: 'shopper'`), so it cannot be moved to collect points again; staff may change
 * or clear it.
 */
export async function setCustomerBirthday(
  ctx: StoreContext,
  customerId: string,
  raw: string | null,
  by: 'shopper' | 'staff',
): Promise<BirthdayResult> {
  const birthday = raw === null || raw.trim() === '' ? null : normaliseBirthday(raw)
  if (raw && raw.trim() !== '' && !birthday) return { ok: false, reason: 'invalid' }
  if (by === 'shopper' && !birthday) return { ok: false, reason: 'invalid' }
  const [c] = await ctx.tx
    .select({ id: customer.id, birthday: customer.birthday })
    .from(customer)
    .where(eq(customer.id, customerId))
    .for('update')
  if (!c) return { ok: false, reason: 'not_found' }
  if (by === 'shopper' && c.birthday) return { ok: false, reason: 'already_set' }
  await ctx.tx
    .update(customer)
    .set({ birthday, updatedAt: new Date() })
    .where(eq(customer.id, customerId))
  return { ok: true, birthday }
}
