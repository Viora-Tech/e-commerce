import { sql } from 'drizzle-orm'
import {
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { cart, customer, customerSegment, newId, order, store } from './schema'

/*
 * Marketing: sessions with their channel, email and WhatsApp campaigns, and
 * automations (triggered sequences) with their runs and messages.
 */

const id = () => uuid('id').primaryKey().$defaultFn(newId)
const storeId = () =>
  uuid('store_id')
    .notNull()
    .references(() => store.id)
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()

/**
 * One storefront session (30 minutes of inactivity ends it), written when it
 * starts, with the channel and UTM tags it arrived on. Sessions by channel and
 * by campaign on the Marketing overview are counted from here.
 */
export const marketingSession = pgTable(
  'marketing_session',
  {
    id: id(),
    storeId: storeId(),
    /** The anonymous `wc_vid` cookie, never linked to a person. */
    visitorId: text('visitor_id').notNull(),
    channel: text('channel').notNull(),
    source: text('source'),
    medium: text('medium'),
    campaign: text('campaign'),
    content: text('content'),
    term: text('term'),
    referrer: text('referrer'),
    landingPath: text('landing_path'),
    /** Our own campaign or automation, when the session began on a tracked email link. */
    campaignId: uuid('campaign_id'),
    automationId: uuid('automation_id'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('marketing_session_store_started').on(t.storeId, t.startedAt),
    index('marketing_session_campaign').on(t.campaignId),
  ],
)

export type MarketingCampaignKind = 'email' | 'whatsapp'
export type MarketingCampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'sending'
  | 'sent'
  | 'cancelled'
  | 'failed'

/** Approved WhatsApp template chosen for a broadcast or an automation step. */
export type WhatsappTemplateRef = {
  name: string
  language: string
  /** One value per {{n}} placeholder, in order; may hold merge tags like {first_name}. */
  variables: string[]
}

/** A one-off send to a customer segment: an email (Shopify Email style) or a WhatsApp broadcast. */
export const marketingCampaign = pgTable(
  'marketing_campaign',
  {
    id: id(),
    storeId: storeId(),
    kind: text('kind').$type<MarketingCampaignKind>().notNull(),
    name: text('name').notNull(),
    status: text('status').$type<MarketingCampaignStatus>().notNull().default('draft'),
    /** Saved customer segment; null sends to every subscriber. */
    segmentId: uuid('segment_id').references(() => customerSegment.id, { onDelete: 'set null' }),
    subject: text('subject').notNull().default(''),
    previewText: text('preview_text').notNull().default(''),
    /** Email blocks, validated by @commerce/core EmailBlocksSchema. */
    blocks: jsonb('blocks').$type<unknown[]>().notNull().default([]),
    whatsapp: jsonb('whatsapp').$type<WhatsappTemplateRef>(),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    /** Recipients materialised when sending began. */
    audienceCount: integer('audience_count').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'marketing_campaign_status',
      sql`${t.status} in ('draft','scheduled','sending','sent','cancelled','failed')`,
    ),
    check('marketing_campaign_kind', sql`${t.kind} in ('email','whatsapp')`),
    index('marketing_campaign_store_status').on(t.storeId, t.status),
  ],
)

export type MarketingAutomationStatus = 'active' | 'paused'

/**
 * A triggered sequence (Shopify Marketing automations): a trigger, then steps
 * that wait, check a condition or send an email or WhatsApp template.
 */
export const marketingAutomation = pgTable(
  'marketing_automation',
  {
    id: id(),
    storeId: storeId(),
    /** Template it was created from, e.g. `abandoned_checkout`. */
    template: text('template').notNull(),
    trigger: text('trigger').notNull(),
    name: text('name').notNull(),
    status: text('status').$type<MarketingAutomationStatus>().notNull().default('paused'),
    /** Steps, validated by @commerce/core AutomationStepsSchema. */
    steps: jsonb('steps').$type<unknown[]>().notNull().default([]),
    /** Trigger settings, e.g. { afterMinutes } or { lapsedDays }. */
    settings: jsonb('settings').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('marketing_automation_status', sql`${t.status} in ('active','paused')`),
    index('marketing_automation_store_trigger').on(t.storeId, t.trigger),
  ],
)

export type MarketingRunStatus = 'active' | 'completed' | 'converted' | 'stopped'

/** One customer going through one automation. `trigger_key` keeps enrolment idempotent. */
export const marketingAutomationRun = pgTable(
  'marketing_automation_run',
  {
    id: id(),
    storeId: storeId(),
    automationId: uuid('automation_id')
      .notNull()
      .references(() => marketingAutomation.id, { onDelete: 'cascade' }),
    triggerKey: text('trigger_key').notNull(),
    customerId: uuid('customer_id').references(() => customer.id),
    cartId: uuid('cart_id').references(() => cart.id),
    orderId: uuid('order_id').references(() => order.id),
    email: text('email'),
    phone: text('phone'),
    name: text('name'),
    status: text('status').$type<MarketingRunStatus>().notNull().default('active'),
    /** Index of the next step to run. */
    stepIndex: integer('step_index').notNull().default(0),
    nextAt: timestamp('next_at', { withTimezone: true }).notNull().defaultNow(),
    /** Why a run stopped early, e.g. `condition` or `unsubscribed`. */
    stopReason: text('stop_reason'),
    convertedOrderId: uuid('converted_order_id').references(() => order.id),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
  },
  (t) => [
    check('marketing_run_status', sql`${t.status} in ('active','completed','converted','stopped')`),
    uniqueIndex('marketing_run_trigger').on(t.automationId, t.triggerKey),
    index('marketing_run_due').on(t.storeId, t.status, t.nextAt),
  ],
)

export type MarketingMessageStatus = 'queued' | 'sent' | 'failed' | 'skipped'

/**
 * Every marketing send, from a campaign or an automation step. Opens and
 * clicks come back through the storefront's tracking links.
 */
export const marketingMessage = pgTable(
  'marketing_message',
  {
    id: id(),
    storeId: storeId(),
    campaignId: uuid('campaign_id').references(() => marketingCampaign.id, {
      onDelete: 'cascade',
    }),
    automationId: uuid('automation_id').references(() => marketingAutomation.id, {
      onDelete: 'cascade',
    }),
    runId: uuid('run_id').references(() => marketingAutomationRun.id, { onDelete: 'cascade' }),
    stepIndex: integer('step_index'),
    customerId: uuid('customer_id').references(() => customer.id),
    channel: text('channel').notNull(),
    to: text('to').notNull(),
    status: text('status').$type<MarketingMessageStatus>().notNull().default('queued'),
    providerRef: text('provider_ref'),
    error: text('error'),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    openedAt: timestamp('opened_at', { withTimezone: true }),
    clickedAt: timestamp('clicked_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    check('marketing_message_status', sql`${t.status} in ('queued','sent','failed','skipped')`),
    uniqueIndex('marketing_message_campaign_to')
      .on(t.campaignId, t.to)
      .where(sql`campaign_id is not null`),
    uniqueIndex('marketing_message_run_step')
      .on(t.runId, t.stepIndex)
      .where(sql`run_id is not null`),
    index('marketing_message_store_created').on(t.storeId, t.createdAt),
    index('marketing_message_campaign').on(t.campaignId, t.status),
  ],
)

/**
 * A storefront newsletter signup waiting for its confirm link (double opt-in, security
 * audit D-09). Nothing is recorded on a customer until the link is opened: then the
 * customer is created or tagged and gets email marketing consent. One row per email per
 * store; signing up again sends a fresh link. Confirmed rows stay as the proof of when
 * the address was confirmed; erasure deletes them.
 */
export const newsletterSignup = pgTable(
  'newsletter_signup',
  {
    id: id(),
    storeId: storeId(),
    email: text('email').notNull(),
    status: text('status', { enum: ['pending', 'confirmed'] })
      .notNull()
      .default('pending'),
    /** The link stops working after this; a new signup sends a new one. */
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('newsletter_signup_store_email').on(t.storeId, t.email),
    check('newsletter_signup_status_check', sql`${t.status} in ('pending', 'confirmed')`),
  ],
)

/**
 * A short link (Growth → Links): `/l/<slug>` on the storefront redirects to `destination` (a
 * path on this store) with its UTM tags added, counts the click and marks the visit so orders
 * it brings carry `attribution.linkId`.
 */
export const shortLink = pgTable(
  'short_link',
  {
    id: id(),
    storeId: storeId(),
    /** Lower-case letters, numbers and hyphens; unique per store. */
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    /** A path on the store, with any query string: `/collections/glasspads?sort=new`. */
    destination: text('destination').notNull(),
    utmSource: text('utm_source'),
    utmMedium: text('utm_medium'),
    utmCampaign: text('utm_campaign'),
    utmContent: text('utm_content'),
    utmTerm: text('utm_term'),
    /** The staff user who made it. */
    createdBy: text('created_by'),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('short_link_store_slug').on(t.storeId, t.slug),
    check('short_link_slug_format', sql`${t.slug} ~ '^[a-z0-9][a-z0-9-]{0,59}$'`),
  ],
)

/** Clicks on a short link per store-local day; bots and link previews are not counted. */
export const shortLinkClickDay = pgTable(
  'short_link_click_day',
  {
    id: id(),
    storeId: storeId(),
    linkId: uuid('link_id')
      .notNull()
      .references(() => shortLink.id, { onDelete: 'cascade' }),
    day: date('day', { mode: 'string' }).notNull(),
    clicks: integer('clicks').notNull().default(0),
  },
  (t) => [uniqueIndex('short_link_click_day_link_day').on(t.linkId, t.day)],
)
