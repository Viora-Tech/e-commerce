/** Shipping tables, split out of schema.ts: courier shipments and their pickups, manifests, webhooks and wallet balances, shipping profiles, and the zones and rates checkout quotes from. */
import { sql } from 'drizzle-orm'
import {
  boolean,
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
import { fulfillmentOrder, newId, order, product, store, variant } from './schema'

const id = () => uuid('id').primaryKey().$defaultFn(newId)
const storeId = () =>
  uuid('store_id')
    .notNull()
    .references(() => store.id)
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()

/** One courier consignment per order. Tracking is the courier's normalised answer, refreshed by the worker. */
export const shipment = pgTable(
  'shipment',
  {
    id: id(),
    storeId: storeId(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => order.id),
    /** The parcel (fulfilment order) this consignment carries; null on shipments booked before parcels. */
    fulfillmentOrderId: uuid('fulfillment_order_id').references(() => fulfillmentOrder.id),
    provider: text('provider').notNull(),
    waybill: text('waybill').notNull(),
    /** Courier's own id for follow-up calls when not the waybill (RapidShyp); else null. */
    providerRef: text('provider_ref'),
    status: text('status', {
      enum: [
        'created',
        'picked_up',
        'in_transit',
        'out_for_delivery',
        'delivered',
        'rto',
        'cancelled',
      ],
    })
      .notNull()
      .default('created'),
    labelUrl: text('label_url'),
    trackingUrl: text('tracking_url'),
    /** Last Tracking payload from the provider. */
    tracking: jsonb('tracking'),
    weightGrams: integer('weight_grams'),
    lengthCm: integer('length_cm'),
    widthCm: integer('width_cm'),
    heightCm: integer('height_cm'),
    /** Whether this parcel is insured, from the per-shipment toggle (defaults from the store's threshold). */
    insured: boolean('insured').notNull().default(false),
    declaredValuePaise: integer('declared_value_paise'),
    /** `none` until the courier reports an NDR; the courier app's queue works from this. */
    ndrStatus: text('ndr_status', {
      enum: ['none', 'pending', 'action_taken', 'resolved'],
    })
      .notNull()
      .default('none'),
    ndrReason: text('ndr_reason'),
    ndrRaisedAt: timestamp('ndr_raised_at', { withTimezone: true }),
    ndrAction: text('ndr_action', { enum: ['reattempt', 'change_address', 'rto'] }),
    ndrActionAt: timestamp('ndr_action_at', { withTimezone: true }),
    ndrActionRef: text('ndr_action_ref'),
    rtoDeliveredAt: timestamp('rto_delivered_at', { withTimezone: true }),
    pickupId: uuid('pickup_id').references(() => shipmentPickup.id, { onDelete: 'set null' }),
    /** What the courier charged for this consignment (from the booking, or typed by the merchant). */
    courierChargePaise: integer('courier_charge_paise'),
    packingCostPaise: integer('packing_cost_paise'), // packing snapshot when booked or packed
    boxPresetId: text('box_preset_id'),
    /** COD or prepaid as booked (the merchant can switch it from the order's own); null on older rows. */
    paymentMode: text('payment_mode', { enum: ['cod', 'prepaid'] }),
    /** What the courier collects at the door, as booked; 0 for prepaid, null on older rows. */
    codAmountPaise: integer('cod_amount_paise'),
    /** Where the courier collects it, as booked: its pickup location name, else the address name. */
    pickupLocationName: text('pickup_location_name'),
    /** The courier service booked ("Surface", "Express", an aggregator's carrier), when picked. */
    serviceLabel: text('service_label'),
    /** The carrier that delivers it ("Blue Dart" for a Shiprocket booking); null on older rows. */
    carrier: text('carrier'),
    /** When the courier's delivered scan landed; null until then (and on older rows). */
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('shipment_provider_waybill').on(t.provider, t.waybill),
    index('shipment_order').on(t.orderId),
    index('shipment_store_ndr').on(t.storeId, t.ndrStatus),
    index('shipment_pickup_id').on(t.pickupId),
    index('shipment_fulfillment_order').on(t.fulfillmentOrderId),
  ],
)

/**
 * An order sent to a courier app (Shiprocket, RapidShyp) as a pending order, without booking:
 * the merchant books it there or here later. One row per order and courier; booking here reuses
 * `externalOrderId`/`externalShipmentId` instead of creating a second order at the courier.
 * Rules: @commerce/core shipping/order-push.ts.
 */
export const courierOrder = pgTable(
  'courier_order',
  {
    id: id(),
    storeId: storeId(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => order.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    externalOrderId: text('external_order_id'),
    externalShipmentId: text('external_shipment_id'),
    status: text('status', { enum: ['pushed', 'failed', 'booked', 'cancelled'] }).notNull(),
    error: text('error'),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('courier_order_order_provider').on(t.orderId, t.provider)],
)

/**
 * A pickup request booked with a courier for a batch of shipments (Delhivery:
 * `schedulePickup`, a Create Pickup API call). `shipment.pickup_id` points
 * back here; a manifest groups some or all of a pickup's shipments into one
 * printable batch of labels.
 */
export const shipmentPickup = pgTable(
  'shipment_pickup',
  {
    id: id(),
    storeId: storeId(),
    provider: text('provider').notNull(),
    scheduledFor: date('scheduled_for').notNull(),
    timeFrom: text('time_from').notNull(),
    timeTo: text('time_to'),
    expectedPackageCount: integer('expected_package_count').notNull().default(0),
    /** The courier pickup location (warehouse) asked to be collected from; null on older rows. */
    pickupLocationName: text('pickup_location_name'),
    status: text('status', {
      enum: ['requested', 'scheduled', 'completed', 'failed'],
    })
      .notNull()
      .default('requested'),
    providerRef: text('provider_ref'),
    error: text('error'),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('shipment_pickup_store').on(t.storeId, t.scheduledFor)],
)

/** A batch of shipments handed to the courier together, printed as one sheet. Our own record; not every courier has a matching API concept. */
export const shipmentManifest = pgTable(
  'shipment_manifest',
  {
    id: id(),
    storeId: storeId(),
    provider: text('provider').notNull(),
    pickupId: uuid('pickup_id').references(() => shipmentPickup.id),
    shipmentIds: uuid('shipment_ids').array().notNull().default([]),
    providerRef: text('provider_ref'),
    createdAt: createdAt(),
  },
  (t) => [index('shipment_manifest_store').on(t.storeId, t.createdAt)],
)

/**
 * Dedupe log for the tracking webhook, the same pattern as `payment_event`:
 * one row per (store, provider, event id), inserted before the tracking
 * update is applied so a retried delivery from the courier is a no-op.
 */
export const shipmentWebhookEvent = pgTable(
  'shipment_webhook_event',
  {
    id: id(),
    storeId: storeId(),
    provider: text('provider').notNull(),
    eventId: text('event_id').notNull(),
    waybill: text('waybill').notNull(),
    payload: jsonb('payload').notNull(),
    status: text('status', { enum: ['pending', 'processed', 'failed'] })
      .notNull()
      .default('pending'),
    error: text('error'),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
    processedAt: timestamp('processed_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('shipment_webhook_event_provider_event').on(t.storeId, t.provider, t.eventId),
  ],
)

/**
 * Cached courier wallet balance and the merchant's low-balance threshold, one
 * row per (store, provider). Delhivery has no confirmed public balance API
 * (see packages/shipping-delhivery), so `balancePaise` is often set by the
 * merchant themselves from their courier dashboard rather than fetched; a
 * provider that does implement `getWalletBalance` overwrites it on refresh.
 */
export const courierWalletBalance = pgTable(
  'courier_wallet_balance',
  {
    id: id(),
    storeId: storeId(),
    provider: text('provider').notNull(),
    balancePaise: integer('balance_paise').notNull().default(0),
    lowBalanceThresholdPaise: integer('low_balance_threshold_paise').notNull().default(50000),
    source: text('source', { enum: ['api', 'manual'] })
      .notNull()
      .default('manual'),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('courier_wallet_balance_store_provider').on(t.storeId, t.provider)],
)

/**
 * A shipping profile: a set of products with their own zones and rates (Shopify's delivery
 * profiles). Every store has one General profile (`is_default`) holding every product not
 * placed in another profile; a product sits in at most one custom profile. A cart with
 * products from several profiles pays one rate per profile, summed (core `quoteProfiles`).
 */
export const shippingProfile = pgTable(
  'shipping_profile',
  {
    id: id(),
    storeId: storeId(),
    name: text('name').notNull(),
    isDefault: boolean('is_default').notNull().default(false),
    position: integer('position').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('shipping_profile_one_default').on(t.storeId).where(sql`${t.isDefault}`),
    index('shipping_profile_store').on(t.storeId, t.position),
  ],
)

/** A product placed in a custom shipping profile; the General profile keeps no rows. */
export const shippingProfileProduct = pgTable(
  'shipping_profile_product',
  {
    id: id(),
    storeId: storeId(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => shippingProfile.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => product.id, { onDelete: 'cascade' }),
  },
  (t) => [
    // One profile per product: adding it to another profile moves it.
    uniqueIndex('shipping_profile_product_unique').on(t.storeId, t.productId),
    index('shipping_profile_product_profile').on(t.profileId),
  ],
)

/**
 * A single variant placed in a shipping profile (Shopify's profiles hold variants). It wins over
 * its product's row: the variant ships under this profile whatever profile the product is in.
 * A variant is in one profile at most, so placing it in another moves it.
 */
export const shippingProfileVariant = pgTable(
  'shipping_profile_variant',
  {
    id: id(),
    storeId: storeId(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => shippingProfile.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id')
      .notNull()
      .references(() => variant.id, { onDelete: 'cascade' }),
  },
  (t) => [
    uniqueIndex('shipping_profile_variant_unique').on(t.storeId, t.variantId),
    index('shipping_profile_variant_profile').on(t.profileId),
  ],
)

/** One PIN code rule of a shipping zone: `560*` (prefix) or `560001` (exact). */
export type ShippingPincodeRule = { pattern: string; mode: 'include' | 'exclude' }

/**
 * Where a set of shipping rates applies: states and/or PIN code rules. A zone
 * with no states and no include rules covers all of India. When several zones
 * match an address the most specific one wins (see `pickZone` in core).
 *
 * Pattern from Saleor's `ShippingZone` and `ShippingMethodPostalCodeRule`
 * (BSD-3): postal rules include or exclude, kept beside the zone.
 */
export const shippingZone = pgTable(
  'shipping_zone',
  {
    id: id(),
    storeId: storeId(),
    name: text('name').notNull(),
    /**
     * The shipping profile whose products these rates price. Null counts as the store's
     * General profile, so a zone written without one (seeds, older code) still applies.
     */
    profileId: uuid('profile_id').references(() => shippingProfile.id, { onDelete: 'cascade' }),
    /**
     * ISO 3166-1 countries the zone covers (Markets). `{IN}` is the zone as it always was;
     * `state_codes` and the PIN rules only narrow it inside India.
     */
    countryCodes: text('country_codes').array().notNull().default(['IN']),
    /** Two-letter state codes (`KA`, `MH`). */
    stateCodes: text('state_codes').array().notNull().default([]),
    pincodeRules: jsonb('pincode_rules').$type<ShippingPincodeRule[]>().notNull().default([]),
    position: integer('position').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('shipping_zone_store').on(t.storeId, t.position),
    index('shipping_zone_profile').on(t.profileId),
  ],
)

export type ShippingRateCondition = 'none' | 'order_value' | 'weight'

/**
 * A price the shopper can pick at checkout. `condition` bounds it by order
 * value (paise, after discounts) or cart weight (grams): `min` is included,
 * `max` is not, so bands 0 to 500 and 500 to 1000 meet without a gap.
 * `free_above_paise` makes it free from that order value up.
 *
 * Pattern from Saleor's `ShippingMethod` (BSD-3, price or weight based with
 * bounds) and Medusa's shipping options (MIT, flat or calculated per option).
 */
export const shippingRate = pgTable(
  'shipping_rate',
  {
    id: id(),
    storeId: storeId(),
    zoneId: uuid('zone_id')
      .notNull()
      .references(() => shippingZone.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    condition: text('condition', { enum: ['none', 'order_value', 'weight'] })
      .notNull()
      .default('none'),
    minValue: integer('min_value'),
    maxValue: integer('max_value'),
    pricePaise: integer('price_paise').notNull().default(0),
    freeAbovePaise: integer('free_above_paise'),
    /**
     * Cash on delivery fee for this rate. Null keeps the store's COD fee
     * (Settings → Payments); a number replaces it, 0 waives it. Never both.
     */
    codSurchargePaise: integer('cod_surcharge_paise'),
    /** Delivery promise for this rate; null uses the courier's estimate. */
    minTransitDays: integer('min_transit_days'),
    maxTransitDays: integer('max_transit_days'),
    position: integer('position').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('shipping_rate_zone').on(t.zoneId, t.position)],
)
