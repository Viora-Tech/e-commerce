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
import { v7 as uuidv7 } from 'uuid'
import { store } from './schema'

/*
 * Delivery options app (0190): the choices a shopper sees at checkout, built from the courier
 * apps the store connected. Design: docs/superpowers/specs/2026-10-29-delivery-options-design.md.
 * The option and rule bodies are JSONB validated by zod in core
 * (`packages/core/src/shipping/delivery-options/config.ts`); they change rarely.
 */

const id = () =>
  uuid('id')
    .primaryKey()
    .$defaultFn(() => uuidv7())
const storeId = () =>
  uuid('store_id')
    .notNull()
    .references(() => store.id)
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()

/**
 * SOURCE OF TRUTH: deliveryOption
 * WHAT:  One card at checkout (Standard, Express): speed, allowed routes, strategy, price,
 *        insurance, arrival and COD, in `config` (`DeliveryOptionInputSchema`).
 * WHY:   The merchant defines the choices once; the engine picks a route for each per PIN code.
 */
export const deliveryOption = pgTable(
  'delivery_option',
  {
    id: id(),
    storeId: storeId(),
    name: text('name').notNull(),
    position: integer('position').notNull().default(0),
    config: jsonb('config').notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('delivery_option_store').on(t.storeId, t.position)],
)

/**
 * SOURCE OF TRUTH: deliveryRouteRule
 * WHAT:  A product or collection route rule ("Glasspads ship with Delhivery only"): target,
 *        options, allowed routes, default, alternatives, insurance, in `config`
 *        (`RouteRuleInputSchema`). Position orders them; the highest wins a conflict.
 * WHY:   Fragile or high-value products always travel with the courier that insures them.
 */
export const deliveryRouteRule = pgTable(
  'delivery_route_rule',
  {
    id: id(),
    storeId: storeId(),
    name: text('name').notNull(),
    position: integer('position').notNull().default(0),
    config: jsonb('config').notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('delivery_route_rule_store').on(t.storeId, t.position)],
)

/**
 * SOURCE OF TRUTH: deliveryRouteSetting
 * WHAT:  The merchant's facts about one route (`providerId:serviceId`) or one carrier through
 *        one channel (`carrier:delhivery|channel:direct`): insures, the insurance rate (basis
 *        points + minimum), a cost card for routes without a live price, enabled.
 * WHY:   No courier API says whether a route insures or what insurance costs.
 */
export const deliveryRouteSetting = pgTable(
  'delivery_route_setting',
  {
    id: id(),
    storeId: storeId(),
    key: text('key').notNull(),
    /** Null keeps the seeded default (Delhivery direct and aggregators insure). */
    insures: boolean('insures'),
    /** Insurance as basis points of the order value (50 = 0.5%); null: not filled in. */
    insuranceBps: integer('insurance_bps'),
    insuranceMinPaise: integer('insurance_min_paise'),
    /** `CostCardSchema`: first 500 g, each further 500 g, COD fee. */
    costCard: jsonb('cost_card'),
    enabled: boolean('enabled').notNull().default(true),
    /** Checkout names this courier to shoppers; null keeps the default (shown). */
    showName: boolean('show_name'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('delivery_route_setting_key').on(t.storeId, t.key)],
)
