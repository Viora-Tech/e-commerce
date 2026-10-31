/** SOURCE OF TRUTH: RTO risk facts and scoring of orders — WHAT: reads the COD & RTO app's install state and settings, the PIN code's and the shopper's history from this store's own orders and shipments, scores a checkout (and refuses COD when the store's rule says so) or an existing order, and saves the score and its tag on the order / WHY: checkout, "Score again" on the order page and the tests must gather the facts the same way before the pure `scoreRtoRisk` runs */
import {
  address,
  type OrderRtoRisk,
  order,
  returnRequest,
  type StoreTx,
  shipment,
  store,
} from '@commerce/db'
import { and, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm'
import { parseAppsSettings, withAppSettings } from '../apps/settings'
import type { StoreContext } from '../context'
import { CheckoutRuleViolation } from '../errors'
import { importedMethod } from '../order/imported-method'
import { type PincodeHistory, type ShopperHistory, scoreRtoRisk } from './score'
import {
  COD_RTO_APP_ID,
  COD_RTO_TAGS,
  type CodRtoSettings,
  CodRtoSettingsSchema,
  parseCodRtoSettings,
  wantsCodConfirmation,
} from './settings'

/** Whether the store installed the app, and its settings. */
export async function codRtoState(
  tx: StoreTx,
  storeId: string,
): Promise<{ installed: boolean; settings: CodRtoSettings }> {
  const [s] = await tx.select({ apps: store.apps }).from(store).where(eq(store.id, storeId))
  const apps = parseAppsSettings(s?.apps)
  return {
    installed: apps.installed.includes(COD_RTO_APP_ID),
    settings: parseCodRtoSettings(apps.settings?.[COD_RTO_APP_ID]),
  }
}

export async function saveCodRtoSettings(
  tx: StoreTx,
  storeId: string,
  input: unknown,
): Promise<CodRtoSettings> {
  const next = CodRtoSettingsSchema.parse(input)
  const [s] = await tx.select({ apps: store.apps }).from(store).where(eq(store.id, storeId))
  const apps = withAppSettings(parseAppsSettings(s?.apps), COD_RTO_APP_ID, next)
  await tx.update(store).set({ apps }).where(eq(store.id, storeId))
  return next
}

/** Parcels to this PIN code that reached an end (delivered or RTO), other orders only. */
async function pincodeHistory(
  ctx: StoreContext,
  pincode: string,
  excludeOrderId: string | null,
): Promise<PincodeHistory> {
  const [row] = await ctx.tx
    .select({
      finished: sql<number>`count(*)::int`,
      rto: sql<number>`count(*) filter (where ${shipment.status} = 'rto')::int`,
    })
    .from(shipment)
    .innerJoin(order, eq(order.id, shipment.orderId))
    .innerJoin(address, eq(address.id, order.shippingAddressId))
    .where(
      and(
        eq(address.pincode, pincode),
        inArray(shipment.status, ['delivered', 'rto']),
        excludeOrderId ? ne(order.id, excludeOrderId) : undefined,
      ),
    )
  return { finished: Number(row?.finished ?? 0), rto: Number(row?.rto ?? 0) }
}

/** The shopper's earlier orders here, matched by phone or email (guests included). */
async function shopperHistory(
  ctx: StoreContext,
  who: { phone: string | null; email: string | null },
  excludeOrderId: string | null,
): Promise<ShopperHistory> {
  const email = who.email?.trim().toLowerCase() || null
  const match = or(
    who.phone ? eq(order.phone, who.phone) : undefined,
    email ? sql`lower(${order.email}) = ${email}` : undefined,
  )
  if (!match) return { orders: 0, cancelled: 0, delivered: 0, rto: 0 }
  const rtoExists = sql`exists (select 1 from ${returnRequest} r where r.order_id = ${order.id} and r.kind = 'rto')`
  const [row] = await ctx.tx
    .select({
      orders: sql<number>`count(*)::int`,
      cancelled: sql<number>`count(*) filter (where ${order.status} = 'cancelled' and not ${rtoExists})::int`,
      delivered: sql<number>`count(*) filter (where ${order.fulfillmentStatus} = 'delivered' or ${order.status} = 'completed')::int`,
      rto: sql<number>`count(*) filter (where ${rtoExists})::int`,
    })
    .from(order)
    .where(
      and(
        match,
        ne(order.status, 'draft'),
        excludeOrderId ? ne(order.id, excludeOrderId) : undefined,
      ),
    )
  return {
    orders: Number(row?.orders ?? 0),
    cancelled: Number(row?.cancelled ?? 0),
    delivered: Number(row?.delivered ?? 0),
    rto: Number(row?.rto ?? 0),
  }
}

export type RiskFacts = {
  pincode: string
  phone: string | null
  email: string | null
  line1: string
  line2?: string | null | undefined
  orderValuePaise: number
  paymentMethod: string | null
  /** Scoring an existing order: leave it out of its own history. */
  excludeOrderId?: string | null | undefined
}

/** Gather the history and score it, in the shape stored on `order.rto_risk`. */
async function assessRisk(
  ctx: StoreContext,
  facts: RiskFacts,
  settings: CodRtoSettings,
  now: Date = new Date(),
): Promise<OrderRtoRisk> {
  const exclude = facts.excludeOrderId ?? null
  const [pin, shopper] = await Promise.all([
    pincodeHistory(ctx, facts.pincode, exclude),
    shopperHistory(ctx, { phone: facts.phone, email: facts.email }, exclude),
  ])
  const r = scoreRtoRisk(
    {
      pincode: pin,
      shopper,
      address: { line1: facts.line1, line2: facts.line2 },
      orderValuePaise: facts.orderValuePaise,
      paymentMethod: facts.paymentMethod,
    },
    settings.risk,
  )
  return { ...r, scoredAt: now.toISOString() }
}

/** The order's tags with the app's high-risk tag added or taken off for this score. */
export function tagsForRisk(
  tags: readonly string[],
  risk: OrderRtoRisk,
  settings: CodRtoSettings,
): string[] {
  const rest = tags.filter((t) => t !== COD_RTO_TAGS.highRisk)
  return settings.risk.tagOrders && risk.level === 'high' ? [...rest, COD_RTO_TAGS.highRisk] : rest
}

export type CheckoutRisk = {
  risk: OrderRtoRisk
  settings: CodRtoSettings
  /** Send the shopper the confirm / cancel link once the order exists. */
  verify: boolean
}

/**
 * Checkout's step: score the order before it is created (null when the app is not
 * installed) and refuse cash on delivery when the store hides it for high-risk orders.
 */
export async function assessCheckoutRisk(
  ctx: StoreContext,
  facts: Omit<RiskFacts, 'excludeOrderId'>,
): Promise<CheckoutRisk | null> {
  const { installed, settings } = await codRtoState(ctx.tx, ctx.storeId)
  if (!installed) return null
  const risk = await assessRisk(ctx, facts, settings)
  if (facts.paymentMethod === 'cod' && settings.rules.hideCodForHighRisk && risk.level === 'high') {
    throw new CheckoutRuleViolation('cod_high_risk', { storeId: ctx.storeId })
  }
  return {
    risk,
    settings,
    verify: wantsCodConfirmation(settings, {
      paymentMethod: facts.paymentMethod,
      level: risk.level,
    }),
  }
}

/** "Score again" on the order page, and orders placed before the app was installed. */
export async function rescoreOrder(ctx: StoreContext, orderId: string) {
  const { settings } = await codRtoState(ctx.tx, ctx.storeId)
  const [o] = await ctx.tx.select().from(order).where(eq(order.id, orderId))
  if (!o) return null
  const [a] = o.shippingAddressId
    ? await ctx.tx.select().from(address).where(eq(address.id, o.shippingAddressId))
    : []
  if (!a) return null
  const risk = await assessRisk(
    ctx,
    {
      pincode: a.pincode,
      phone: o.phone,
      email: o.email,
      line1: a.line1,
      line2: a.line2,
      orderValuePaise: o.totalPaise,
      // Imported orders keep the old platform's gateway in import_meta (COD counts as COD).
      paymentMethod: o.paymentMethod ?? importedMethod(o.importMeta?.paymentMethod ?? null),
      excludeOrderId: o.id,
    },
    settings,
  )
  await ctx.tx
    .update(order)
    .set({ rtoRisk: risk, tags: tagsForRisk(o.tags, risk, settings) })
    .where(eq(order.id, o.id))
  return risk
}

/** How many open orders "Score open orders" takes in one press. */
const SCORE_OPEN_LIMIT = 300

/**
 * "Score open orders": every open, unshipped order without a risk score, oldest first. Scores
 * are made at checkout, so orders imported from Shopify (Waimers: 61 waiting to ship, 1 scored)
 * and orders placed before the app was installed had none (audit #199).
 */
export async function scoreOpenOrders(
  ctx: StoreContext,
): Promise<{ scored: number; left: number }> {
  const open = and(
    eq(order.status, 'open'),
    eq(order.fulfillmentStatus, 'unfulfilled'),
    isNull(order.rtoRisk),
    sql`${order.shippingAddressId} is not null`,
  )
  const rows = await ctx.tx
    .select({ id: order.id })
    .from(order)
    .where(open)
    .orderBy(order.placedAt)
    .limit(SCORE_OPEN_LIMIT)
  let scored = 0
  for (const r of rows) if (await rescoreOrder(ctx, r.id)) scored += 1
  const [rest] = await ctx.tx.select({ n: sql<number>`count(*)::int` }).from(order).where(open)
  return { scored, left: Number(rest?.n ?? 0) }
}
