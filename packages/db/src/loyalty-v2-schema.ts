import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { customer, discount, newId, order, product, store, variant } from './schema'
import { storeCreditEntry } from './store-credit-schema'

/*
 * Loyalty points v2 (docs/loyalty-v2-interfaces.md): members with a VIP tier and a referral
 * code, earning rules, a rewards catalog shoppers redeem points for, referrals, bonus
 * campaigns, and the queue of loyalty emails. Points still move through `loyalty_entry`.
 */

const at = (name: string) => timestamp(name, { withTimezone: true })
const pk = () => uuid('id').primaryKey().$defaultFn(newId)
const storeRef = () =>
  uuid('store_id')
    .notNull()
    .references(() => store.id)

/** What an earning rule rewards. */
export const LOYALTY_RULE_TYPES = [
  'order_spend',
  'first_order',
  'signup',
  'newsletter',
  'birthday',
  'anniversary',
  'daily_visit',
  'visit_streak',
  'product_review',
  'google_review',
  'social',
] as const

/** The social and link actions a `social` rule can be (its `key`). */
export const LOYALTY_SOCIAL_KINDS = [
  'instagram',
  'youtube',
  'x',
  'facebook',
  'tiktok',
  'pinterest',
  'discord',
  'reddit',
  'telegram',
  'whatsapp',
  'link',
] as const

/** What a reward gives. */
export const LOYALTY_REWARD_TYPES = [
  'amount_off',
  'custom_amount_off',
  'percent_off',
  'free_product',
  'free_shipping',
  'store_credit',
] as const

/** `issued`: code not used yet. `used`: an order took it. `cancelled`: staff cancelled, points back. `expired`: ran out unused. */
export const LOYALTY_REDEMPTION_STATUSES = ['issued', 'used', 'cancelled', 'expired'] as const

/** `pending`: friend signed up. `friend_ordered`: waiting for the hold. `completed`: referrer rewarded. `rejected`: a fraud check failed. */
export const LOYALTY_REFERRAL_STATUSES = [
  'pending',
  'friend_ordered',
  'completed',
  'rejected',
] as const

export const LOYALTY_NOTIFICATION_TEMPLATES = [
  'loyalty_points_earned',
  'loyalty_reward_redeemed',
  'loyalty_reward_expiring',
  'loyalty_birthday',
  'loyalty_tier_unlocked',
  'points_expiring',
] as const

export type LoyaltyRuleType = (typeof LOYALTY_RULE_TYPES)[number]
export type LoyaltyRewardType = (typeof LOYALTY_REWARD_TYPES)[number]
export type LoyaltyRedemptionStatus = (typeof LOYALTY_REDEMPTION_STATUSES)[number]
export type LoyaltyReferralStatus = (typeof LOYALTY_REFERRAL_STATUSES)[number]
export type LoyaltyNotificationTemplate = (typeof LOYALTY_NOTIFICATION_TEMPLATES)[number]

/** A VIP tier's card colours (`#rrggbb`). */
export type LoyaltyTierColors = { background: string; text: string }

/** A reward that a referral gives: points, or a one-use code worth % or ₹ off. */
export type LoyaltyReferralReward = { kind: 'points' | 'percent' | 'fixed'; value: number }

/** VIP tiers, lowest first by `position`. `threshold` is points earned or paise spent (store setting). */
export const loyaltyTier = pgTable(
  'loyalty_tier',
  {
    id: pk(),
    storeId: storeRef(),
    name: text('name').notNull(),
    position: integer('position').notNull().default(0),
    threshold: integer('threshold').notNull().default(0),
    /** Earning multiplier on order points, basis points (12500 = 1.25x). */
    multiplierBp: integer('multiplier_bp').notNull().default(10_000),
    perks: jsonb('perks').$type<string[]>().notNull().default([]),
    /** A reward given free when a member reaches the tier. */
    rewardId: uuid('reward_id'),
    customerTag: text('customer_tag'),
    colors: jsonb('colors').$type<LoyaltyTierColors>(),
    createdAt: at('created_at').notNull().defaultNow(),
    updatedAt: at('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('loyalty_tier_store').on(t.storeId, t.position),
    check('loyalty_tier_threshold_check', sql`${t.threshold} >= 0`),
    check('loyalty_tier_multiplier_check', sql`${t.multiplierBp} between 0 and 100000`),
  ],
)

/** One row per customer in the program: tier, referral code, visit streak. */
export const loyaltyMember = pgTable(
  'loyalty_member',
  {
    id: pk(),
    storeId: storeRef(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customer.id, { onDelete: 'cascade' }),
    tierId: uuid('tier_id').references(() => loyaltyTier.id, { onDelete: 'set null' }),
    tierChangedAt: at('tier_changed_at'),
    referralCode: text('referral_code').notNull(),
    referredById: uuid('referred_by_id').references(() => customer.id, { onDelete: 'set null' }),
    /** The store-time day of the last counted visit (`YYYY-MM-DD`). */
    lastVisitDay: text('last_visit_day'),
    streakDays: integer('streak_days').notNull().default(0),
    /** The store-time day the nightly sweep last worked out this member's tier. */
    tierCheckedDay: text('tier_checked_day'),
    joinedAt: at('joined_at').notNull().defaultNow(),
    createdAt: at('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('loyalty_member_customer').on(t.storeId, t.customerId),
    uniqueIndex('loyalty_member_referral_code').on(t.storeId, t.referralCode),
    index('loyalty_member_tier').on(t.storeId, t.tierId),
  ],
)

/** Every tier move, for the history and the "tier unlocked" email. */
export const loyaltyTierChange = pgTable(
  'loyalty_tier_change',
  {
    id: pk(),
    storeId: storeRef(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customer.id, { onDelete: 'cascade' }),
    fromTierId: uuid('from_tier_id').references(() => loyaltyTier.id, { onDelete: 'set null' }),
    toTierId: uuid('to_tier_id').references(() => loyaltyTier.id, { onDelete: 'set null' }),
    createdAt: at('created_at').notNull().defaultNow(),
  },
  (t) => [index('loyalty_tier_change_store').on(t.storeId, t.createdAt)],
)

/** Ways to earn. `key` tells two rules of one type apart (a `social` rule's platform); '' otherwise. */
export const loyaltyEarnRule = pgTable(
  'loyalty_earn_rule',
  {
    id: pk(),
    storeId: storeRef(),
    type: text('type', { enum: LOYALTY_RULE_TYPES }).notNull(),
    key: text('key').notNull().default(''),
    title: text('title'),
    /** Points given; for `order_spend`, points per ₹100. */
    points: integer('points').notNull().default(0),
    settings: jsonb('settings').$type<Record<string, unknown>>().notNull().default({}),
    enabled: boolean('enabled').notNull().default(true),
    position: integer('position').notNull().default(0),
    createdAt: at('created_at').notNull().defaultNow(),
    updatedAt: at('updated_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('loyalty_earn_rule_type_key').on(t.storeId, t.type, t.key),
    check('loyalty_earn_rule_points_check', sql`${t.points} between 0 and 1000000`),
  ],
)

/** The rewards catalog. Values: paise for amounts, basis points for a percent. */
export const loyaltyReward = pgTable(
  'loyalty_reward',
  {
    id: pk(),
    storeId: storeRef(),
    type: text('type', { enum: LOYALTY_REWARD_TYPES }).notNull(),
    title: text('title').notNull(),
    description: text('description'),
    /** Points it costs; for `custom_amount_off`, points per step. */
    pointsCost: integer('points_cost').notNull(),
    /** Paise off, basis points off, or store credit paise; for `custom_amount_off`, paise per step. */
    value: integer('value').notNull().default(0),
    /** `custom_amount_off`: fewest and most points one redemption may spend. */
    minPoints: integer('min_points'),
    maxPoints: integer('max_points'),
    productId: uuid('product_id').references(() => product.id, { onDelete: 'set null' }),
    variantId: uuid('variant_id').references(() => variant.id, { onDelete: 'set null' }),
    minOrderPaise: integer('min_order_paise'),
    /** Null: every member; else members at this tier or above. */
    minTierId: uuid('min_tier_id').references(() => loyaltyTier.id, { onDelete: 'set null' }),
    usageLimit: integer('usage_limit'),
    oncePerCustomer: boolean('once_per_customer').notNull().default(false),
    usedCount: integer('used_count').notNull().default(0),
    /** Days the issued code works; null never runs out. */
    codeDays: integer('code_days'),
    active: boolean('active').notNull().default(true),
    position: integer('position').notNull().default(0),
    createdAt: at('created_at').notNull().defaultNow(),
    updatedAt: at('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('loyalty_reward_store').on(t.storeId, t.position),
    check('loyalty_reward_cost_check', sql`${t.pointsCost} >= 0`),
    check('loyalty_reward_value_check', sql`${t.value} >= 0`),
  ],
)

/** One reward a member took: the points spent and the code or store credit it gave. */
export const loyaltyRedemption = pgTable(
  'loyalty_redemption',
  {
    id: pk(),
    storeId: storeRef(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customer.id, { onDelete: 'cascade' }),
    rewardId: uuid('reward_id').references(() => loyaltyReward.id, { onDelete: 'set null' }),
    rewardType: text('reward_type', { enum: LOYALTY_REWARD_TYPES }).notNull(),
    title: text('title').notNull(),
    points: integer('points').notNull(),
    /** What it is worth: paise off or credited; basis points for a percent. */
    value: integer('value').notNull().default(0),
    discountId: uuid('discount_id').references(() => discount.id, { onDelete: 'set null' }),
    code: text('code'),
    storeCreditEntryId: uuid('store_credit_entry_id').references(() => storeCreditEntry.id),
    status: text('status', { enum: LOYALTY_REDEMPTION_STATUSES }).notNull().default('issued'),
    orderId: uuid('order_id').references(() => order.id, { onDelete: 'set null' }),
    /** Why it was given: `redeem`, `tier` (a tier's reward) or `referral`. */
    via: text('via').notNull().default('redeem'),
    expiresAt: at('expires_at'),
    cancelledAt: at('cancelled_at'),
    cancelledBy: text('cancelled_by'),
    createdAt: at('created_at').notNull().defaultNow(),
  },
  (t) => [
    index('loyalty_redemption_customer').on(t.storeId, t.customerId, t.createdAt),
    index('loyalty_redemption_reward').on(t.storeId, t.rewardId, t.customerId),
    uniqueIndex('loyalty_redemption_discount').on(t.discountId),
    check('loyalty_redemption_points_check', sql`${t.points} >= 0`),
    check(
      'loyalty_redemption_status_check',
      sql`${t.status} in ('issued', 'used', 'cancelled', 'expired')`,
    ),
  ],
)

/** A friend who came with a member's referral code. One per friend (a leaked code works once per new customer). */
export const loyaltyReferral = pgTable(
  'loyalty_referral',
  {
    id: pk(),
    storeId: storeRef(),
    referrerId: uuid('referrer_id')
      .notNull()
      .references(() => customer.id, { onDelete: 'cascade' }),
    friendId: uuid('friend_id')
      .notNull()
      .references(() => customer.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    status: text('status', { enum: LOYALTY_REFERRAL_STATUSES }).notNull().default('pending'),
    rejectReason: text('reject_reason'),
    deviceId: text('device_id'),
    friendOrderId: uuid('friend_order_id').references(() => order.id, { onDelete: 'set null' }),
    friendRedemptionId: uuid('friend_redemption_id'),
    referrerRedemptionId: uuid('referrer_redemption_id'),
    /** When the referrer's reward may be given (friend's order delivered + return window). */
    availableAt: at('available_at'),
    completedAt: at('completed_at'),
    createdAt: at('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('loyalty_referral_friend').on(t.storeId, t.friendId),
    index('loyalty_referral_referrer').on(t.storeId, t.referrerId),
    index('loyalty_referral_due').on(t.storeId, t.status, t.availableAt),
    check(
      'loyalty_referral_status_check',
      sql`${t.status} in ('pending', 'friend_ordered', 'completed', 'rejected')`,
    ),
  ],
)

/** Bonus campaigns: a points multiplier or fixed bonus on orders placed in a window. */
export const loyaltyCampaign = pgTable(
  'loyalty_campaign',
  {
    id: pk(),
    storeId: storeRef(),
    name: text('name').notNull(),
    startsAt: at('starts_at').notNull(),
    endsAt: at('ends_at').notNull(),
    /** Empty: every member; else only these tiers. */
    tierIds: jsonb('tier_ids').$type<string[]>().notNull().default([]),
    bonusType: text('bonus_type', { enum: ['multiplier', 'fixed'] }).notNull(),
    multiplierBp: integer('multiplier_bp').notNull().default(10_000),
    bonusPoints: integer('bonus_points').notNull().default(0),
    active: boolean('active').notNull().default(true),
    createdAt: at('created_at').notNull().defaultNow(),
    updatedAt: at('updated_at').notNull().defaultNow(),
  },
  (t) => [
    index('loyalty_campaign_window').on(t.storeId, t.startsAt, t.endsAt),
    check('loyalty_campaign_window_check', sql`${t.endsAt} > ${t.startsAt}`),
  ],
)

/** Loyalty emails waiting to go: one row per (customer, dedupe key), sent by the worker. */
export const loyaltyNotification = pgTable(
  'loyalty_notification',
  {
    id: pk(),
    storeId: storeRef(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customer.id, { onDelete: 'cascade' }),
    template: text('template', { enum: LOYALTY_NOTIFICATION_TEMPLATES }).notNull(),
    dedupeKey: text('dedupe_key').notNull(),
    data: jsonb('data').$type<Record<string, unknown>>().notNull().default({}),
    sentAt: at('sent_at'),
    createdAt: at('created_at').notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('loyalty_notification_once').on(t.storeId, t.customerId, t.dedupeKey),
    index('loyalty_notification_unsent').on(t.storeId, t.sentAt),
  ],
)
