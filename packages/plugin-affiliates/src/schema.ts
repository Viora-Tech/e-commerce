import { customer, newId, order, store } from '@commerce/db'
import { sql } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import type { CommissionRule } from './settings'

/**
 * Tables owned by the Affiliates app. They live in the platform's single migration chain
 * (packages/db/drizzle, 0158 and 0163) and carry `store_id`, so `apply_store_rls()` isolates
 * them like core tables. Store-wide settings are in `store.apps.settings.affiliates`; each
 * program's rules are a row here (./settings).
 */

/**
 * A program: its own commission, levels, exclusions, approval, code and signup page. Every
 * store using the app has exactly one default program (the one v1 settings became); affiliates
 * without a program belong to it. `rules` is a `ProgramRules` (parse it with
 * `parseProgramRules`). Archived programs take no signups; their affiliates were moved.
 */
export const affiliateProgram = pgTable(
  'affiliate_program',
  {
    id: uuid('id').primaryKey().$defaultFn(newId),
    storeId: uuid('store_id')
      .notNull()
      .references(() => store.id),
    name: text('name').notNull(),
    /** `/affiliate?program=<slug>`. */
    slug: text('slug').notNull(),
    isDefault: boolean('is_default').notNull().default(false),
    rules: jsonb('rules').notNull().default({}),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('affiliate_program_store_slug').on(t.storeId, t.slug),
    uniqueIndex('affiliate_program_store_default').on(t.storeId).where(sql`is_default`),
  ],
)

/**
 * One affiliate: a storefront customer who applied (or the merchant added). `code` is the
 * `?ref=` value and, upper-cased, their coupon. Payout details are one `encryptSecret` blob,
 * never stored or logged in the clear; `payoutHint` is the masked line the admin shows.
 */
export const affiliate = pgTable(
  'affiliate',
  {
    id: uuid('id').primaryKey().$defaultFn(newId),
    storeId: uuid('store_id')
      .notNull()
      .references(() => store.id),
    customerId: uuid('customer_id').references(() => customer.id, { onDelete: 'set null' }),
    /** Their program; null means the store's default program. */
    programId: uuid('program_id').references(() => affiliateProgram.id),
    /** Their own default rate, above the program's levels and default (a `CommissionRule`). */
    rateOverride: jsonb('rate_override').$type<CommissionRule | null>(),
    code: text('code').notNull(),
    name: text('name').notNull().default(''),
    email: text('email'),
    /** `phoneBlindIndex` of the last ten digits, for the self-referral check only. */
    phoneIndex: text('phone_index'),
    status: text('status', { enum: ['pending', 'approved', 'rejected', 'suspended'] })
      .notNull()
      .default('pending'),
    /** Where they post (Instagram handle, YouTube channel), from the application. */
    social: text('social').notNull().default(''),
    /** What they wrote when applying. */
    message: text('message').notNull().default(''),
    /** The merchant's private note. */
    note: text('note').notNull().default(''),
    /** The personal discount made for them, and its code. */
    discountId: uuid('discount_id'),
    couponCode: text('coupon_code'),
    payoutMethod: text('payout_method', { enum: ['upi', 'bank'] }),
    payoutDetails: text('payout_details'),
    payoutHint: text('payout_hint'),
    hasPan: boolean('has_pan').notNull().default(false),
    /** They gave a GSTIN (kept inside the encrypted payout details): GST is added to payouts. */
    gstRegistered: boolean('gst_registered').notNull().default(false),
    clicks: integer('clicks').notNull().default(0),
    /** HMAC blind indexes (settings key) of their PAN and payee (UPI id, or account@ifsc), for the duplicate check. */
    panIndex: text('pan_index'),
    payeeIndex: text('payee_index'),
    /** Blind index of the IP they applied from, for the blocklist. */
    signupIpIndex: text('signup_ip_index'),
    /** Why their payouts wait for the merchant (`ReviewReason`); empty when nothing needs a look. */
    reviewReasons: jsonb('review_reasons').$type<string[]>().notNull().default([]),
    /** Their request for their own code (`CodeRequest`), waiting for the merchant or decided. */
    codeRequest: jsonb('code_request').$type<{
      code: string
      at: string
      status: 'pending' | 'approved' | 'declined'
    } | null>(),
    /** How they joined: applied on the signup page, added by the merchant, or a buyer's Share and earn tap. */
    source: text('source', { enum: ['applied', 'added', 'enrolled'] })
      .notNull()
      .default('applied'),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('affiliate_store_code').on(t.storeId, t.code),
    uniqueIndex('affiliate_store_customer').on(t.storeId, t.customerId),
    index('affiliate_store_status').on(t.storeId, t.status),
    index('affiliate_store_program').on(t.storeId, t.programId),
  ],
)

/**
 * A payout: approved commissions grouped for one affiliate, marked paid by the merchant after
 * paying outside the platform (UPI or a bank bulk upload). No money moves here.
 */
export const affiliatePayout = pgTable(
  'affiliate_payout',
  {
    id: uuid('id').primaryKey().$defaultFn(newId),
    storeId: uuid('store_id')
      .notNull()
      .references(() => store.id),
    affiliateId: uuid('affiliate_id')
      .notNull()
      .references(() => affiliate.id),
    grossPaise: integer('gross_paise').notNull(),
    tdsPaise: integer('tds_paise').notNull().default(0),
    /** GST added for a GST-registered affiliate, on the commission less clawbacks. */
    gstPaise: integer('gst_paise').notNull().default(0),
    /** Clawbacks of earlier paid commissions taken off this payout. */
    clawbackPaise: integer('clawback_paise').notNull().default(0),
    netPaise: integer('net_paise').notNull(),
    status: text('status', { enum: ['pending', 'paid'] })
      .notNull()
      .default('pending'),
    /** UTR or the merchant's own reference, from "Mark paid". */
    reference: text('reference').notNull().default(''),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('affiliate_payout_store_status').on(t.storeId, t.status, t.createdAt)],
)

/**
 * The commission on one order (at most one per order). `basePaise` is the net sale it is on;
 * `tdsPaise` is set when it is approved. `flag` holds a fraud finding that keeps it from
 * being approved until the merchant decides.
 */
export const affiliateCommission = pgTable(
  'affiliate_commission',
  {
    id: uuid('id').primaryKey().$defaultFn(newId),
    storeId: uuid('store_id')
      .notNull()
      .references(() => store.id),
    affiliateId: uuid('affiliate_id')
      .notNull()
      .references(() => affiliate.id),
    orderId: uuid('order_id')
      .notNull()
      .references(() => order.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id'),
    /** The program the commission was worked out under (a snapshot, for reports). */
    programId: uuid('program_id'),
    source: text('source', { enum: ['link', 'coupon', 'lifetime'] }).notNull(),
    status: text('status', { enum: ['pending', 'approved', 'paid', 'reversed'] })
      .notNull()
      .default('pending'),
    basePaise: integer('base_paise').notNull(),
    /** What the order earned when it was placed; `commissionPaise` shrinks with partial refunds. */
    earnedPaise: integer('earned_paise').notNull(),
    commissionPaise: integer('commission_paise').notNull(),
    tdsPaise: integer('tds_paise').notNull().default(0),
    flag: text('flag'),
    placedAt: timestamp('placed_at', { withTimezone: true }).notNull(),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    eligibleAt: timestamp('eligible_at', { withTimezone: true }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    reversedAt: timestamp('reversed_at', { withTimezone: true }),
    reversedReason: text('reversed_reason'),
    payoutId: uuid('payout_id').references(() => affiliatePayout.id),
    /**
     * Money to win back: the commission was already in a payout when its order was refunded,
     * cancelled or returned. The affiliate's next payout is lowered by it.
     */
    clawbackPaise: integer('clawback_paise').notNull().default(0),
    /** The payout that recovered the clawback. */
    clawbackPayoutId: uuid('clawback_payout_id').references(() => affiliatePayout.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('affiliate_commission_store_order').on(t.storeId, t.orderId),
    index('affiliate_commission_store_affiliate').on(t.storeId, t.affiliateId, t.status),
    index('affiliate_commission_store_due').on(t.storeId, t.status, t.eligibleAt),
    index('affiliate_commission_store_customer').on(t.storeId, t.customerId),
  ],
)

/**
 * Values the store refuses or holds: buyers' emails, domains and phones (their commissions are
 * held), applicants' emails and IPs (refused), and PANs and payees (the affiliate waits for
 * review). The value is kept encrypted beside its blind index, so a key rotation can recompute it.
 */
export const affiliateBlocklist = pgTable(
  'affiliate_blocklist',
  {
    id: uuid('id').primaryKey().$defaultFn(newId),
    storeId: uuid('store_id')
      .notNull()
      .references(() => store.id),
    kind: text('kind', {
      enum: ['email', 'email_domain', 'phone', 'ip', 'pan', 'payee'],
    }).notNull(),
    /** `encryptSecret` of the normalised value (`blocklistKey`). */
    value: text('value').notNull(),
    valueIndex: text('value_index').notNull(),
    /** The masked line the admin shows. */
    hint: text('hint').notNull(),
    note: text('note').notNull().default(''),
    createdBy: text('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('affiliate_blocklist_store_value').on(t.storeId, t.kind, t.valueIndex)],
)

/**
 * Every link code and coupon an affiliate has had. `affiliate.code` and `coupon_code` hold the
 * current ones; a retired link code still earns (old posts keep paying), a retired coupon's
 * discount is disabled.
 */
export const affiliateCode = pgTable(
  'affiliate_code',
  {
    id: uuid('id').primaryKey().$defaultFn(newId),
    storeId: uuid('store_id')
      .notNull()
      .references(() => store.id),
    affiliateId: uuid('affiliate_id')
      .notNull()
      .references(() => affiliate.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: ['link', 'coupon'] }).notNull(),
    code: text('code').notNull(),
    discountId: uuid('discount_id'),
    status: text('status', { enum: ['active', 'retired'] })
      .notNull()
      .default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    retiredAt: timestamp('retired_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('affiliate_code_store_kind_code').on(t.storeId, t.kind, t.code),
    index('affiliate_code_affiliate').on(t.storeId, t.affiliateId),
  ],
)
