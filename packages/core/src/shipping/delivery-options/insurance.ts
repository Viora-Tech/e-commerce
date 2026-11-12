/** SOURCE OF TRUTH: shipping insurance on a booking — WHAT: what insurance adds to one Create
 * shipment rate row (the courier's own line, the merchant's route rate, or Delhivery Protect for
 * the parcel's products) and the facts it needs (route settings, Protect card, the products'
 * categories) / WHY: the drawer's price, the shipment's recorded insurance cost and the shipping
 * margin must be the same number checkout priced, and couriers' rate APIs give none.
 */
import {
  fulfillmentOrder,
  fulfillmentOrderLine,
  orderLine,
  product,
  type StoreTx,
  variant,
} from '@commerce/db'
import { and, eq, inArray, ne } from 'drizzle-orm'
import type { CourierRateRow, RowCover, RowInsurance } from '../courier-rates'
import { rowRoute } from './booking'
import type { RouteSetting } from './config'
import {
  courierCover,
  DEFAULT_PROTECT_CARD,
  isUsedProduct,
  type ProtectCard,
  type ProtectQuote,
  parcelProtect,
} from './protect'
import { AGGREGATOR_PROVIDERS, insuranceQuote } from './routes'
import { loadDeliveryConfig, productFacts } from './service'

/** What pricing one parcel's insurance reads. */
export type InsuranceFacts = {
  settings: readonly RouteSetting[]
  protect: ProtectQuote
  /** The store's card: Protect rates and each courier's cover terms. */
  card: ProtectCard
  /** The parcel holds a used, refurbished or open-box product (`isUsedProduct`). */
  hasUsedItems: boolean
}

/** What this courier pays if the parcel is lost, with and without insurance, and its terms. */
export function rowCover(
  row: Pick<CourierRateRow, 'providerId'>,
  facts: Pick<InsuranceFacts, 'card' | 'hasUsedItems'>,
  valuePaise: number,
): RowCover {
  return {
    ...courierCover(row.providerId, facts.card),
    valuePaise,
    hasUsedItems: facts.hasUsedItems,
  }
}

/**
 * What turning insurance on adds to this row for a parcel worth `valuePaise`. `courier` means
 * the courier already itemised it inside the row's price. Null: no rate is known for the route.
 */
export function rowInsurance(
  row: Pick<
    CourierRateRow,
    | 'providerId'
    | 'providerName'
    | 'serviceId'
    | 'serviceLabel'
    | 'carrier'
    | 'charges'
    | 'pricePaise'
    | 'minTransitDays'
    | 'maxTransitDays'
    | 'codAvailable'
    | 'problem'
  >,
  facts: InsuranceFacts,
  valuePaise: number,
): RowInsurance | null {
  const route = rowRoute(row as CourierRateRow, facts.settings)
  if (!route) return null
  const quoted = row.charges
    .filter((c) => c.kind === 'insurance')
    .reduce((sum, c) => sum + c.pricePaise, 0)
  const q = insuranceQuote(
    quoted > 0 ? { ...route, quotedInsurancePaise: quoted } : route,
    valuePaise,
    facts.protect,
  )
  return q
    ? {
        source: q.source,
        feePaise: q.feePaise,
        gstPaise: q.gstPaise,
        pricePaise: q.pricePaise,
        gstIncluded: q.gstIncluded,
        estimate: q.estimate,
        protectCategory: q.protect?.category ?? null,
        protectBps: q.protect?.bps ?? null,
      }
    : null
}

/**
 * The value a booking declares to the courier (Delhivery's `total_amount` and
 * `commodity_value`), which insurance is priced on: the order's total when the whole order
 * ships (no parcel named, or the order's only parcel), else the parcel's own total, else what
 * its lines add up to.
 */
export function declaredValuePaise(p: {
  parcelId: string | null
  parcelTotalPaise: number | null
  soleParcelId: string | null
  orderTotalPaise: number
  linesPaise: () => number
}): number {
  if (!p.parcelId || p.parcelId === p.soleParcelId) return p.orderTotalPaise
  return p.parcelTotalPaise ?? p.linesPaise()
}

/**
 * `declaredValuePaise` for the Create shipment quote, read as booking reads it, so the drawer's
 * insurance is priced on exactly the value the courier is sent. `fallback` (the value the
 * drawer asked with) stands in for a parcel with no total saved.
 */
export async function quoteDeclaredValuePaise(
  tx: StoreTx,
  orderId: string,
  fulfillmentOrderId: string | null | undefined,
  orderTotalPaise: number,
  fallback: number,
): Promise<number> {
  if (!fulfillmentOrderId) return orderTotalPaise
  const live = await tx
    .select({ id: fulfillmentOrder.id, totalPaise: fulfillmentOrder.totalPaise })
    .from(fulfillmentOrder)
    .where(and(eq(fulfillmentOrder.orderId, orderId), ne(fulfillmentOrder.status, 'cancelled')))
    .limit(3)
  const own = live.find((f) => f.id === fulfillmentOrderId)
  return declaredValuePaise({
    parcelId: fulfillmentOrderId,
    parcelTotalPaise: own?.totalPaise ?? null,
    soleParcelId: live.length === 1 ? (live[0]?.id ?? null) : null,
    orderTotalPaise,
    linesPaise: () => fallback,
  })
}

/**
 * What a booking's insurance costs, recorded on the shipment for its margin: ₹0 when it is not
 * insured, else the same price the drawer showed (`rowInsurance`, without the quote's lines,
 * which booking does not have). Null when insured but no rate is known for the route.
 */
export async function bookingInsurancePaise(
  tx: StoreTx,
  storeId: string,
  b: {
    orderId: string
    fulfillmentOrderId?: string | null | undefined
    provider: { id: string; label: string }
    /** The service booked, as Create shipment passes it. */
    service: {
      serviceId?: string | undefined
      serviceLabel?: string | undefined
      carrier?: string | undefined
    }
    valuePaise: number
    insured: boolean
  },
): Promise<number | null> {
  if (!b.insured) return 0
  const facts = await parcelInsuranceFacts(tx, storeId, b.orderId, b.fulfillmentOrderId)
  const found = rowInsurance(
    {
      providerId: b.provider.id,
      providerName: b.provider.label,
      serviceId: b.service.serviceId ?? null,
      serviceLabel: b.service.serviceLabel ?? null,
      // A direct courier's own service names no carrier behind it, as in the rate rows.
      carrier: AGGREGATOR_PROVIDERS.has(b.provider.id) ? (b.service.carrier ?? null) : null,
      charges: [],
      pricePaise: null,
      minTransitDays: null,
      maxTransitDays: null,
      codAvailable: null,
      problem: null,
    },
    facts,
    b.valuePaise,
  )
  return found?.pricePaise ?? null
}

/** The products in one parcel of an order (its fulfilment order), or in the whole order. */
async function parcelProductIds(
  tx: StoreTx,
  orderId: string,
  fulfillmentOrderId?: string | null,
): Promise<string[]> {
  const rows = fulfillmentOrderId
    ? await tx
        .select({ productId: variant.productId })
        .from(fulfillmentOrderLine)
        .innerJoin(orderLine, eq(orderLine.id, fulfillmentOrderLine.orderLineId))
        .innerJoin(variant, eq(variant.id, orderLine.variantId))
        .where(
          and(
            eq(fulfillmentOrderLine.fulfillmentOrderId, fulfillmentOrderId),
            eq(orderLine.orderId, orderId),
          ),
        )
    : await tx
        .select({ productId: variant.productId })
        .from(orderLine)
        .innerJoin(variant, eq(variant.id, orderLine.variantId))
        .where(eq(orderLine.orderId, orderId))
  return [...new Set(rows.map((r) => r.productId))]
}

/** `insuranceFacts` for one parcel of an order (or the whole order). */
export async function parcelInsuranceFacts(
  tx: StoreTx,
  storeId: string,
  orderId: string,
  fulfillmentOrderId?: string | null,
): Promise<InsuranceFacts> {
  return insuranceFacts(tx, storeId, await parcelProductIds(tx, orderId, fulfillmentOrderId))
}

/**
 * The route settings and the parcel's Protect category for these products. Read whether or not
 * the Delivery options app is on: Delhivery Protect's defaults need no setup.
 */
async function insuranceFacts(
  tx: StoreTx,
  storeId: string,
  productIds: readonly string[],
): Promise<InsuranceFacts> {
  const ids = [...new Set(productIds)]
  const [config, items, named] = await Promise.all([
    loadDeliveryConfig(tx, storeId),
    productFacts(tx, ids),
    ids.length
      ? tx
          .select({ title: product.title, tags: product.tags })
          .from(product)
          .where(inArray(product.id, ids))
      : Promise.resolve([]),
  ])
  const card = config.protect ?? DEFAULT_PROTECT_CARD
  return {
    settings: config.routeSettings,
    protect: parcelProtect(items, card),
    card,
    hasUsedItems: named.some((p) => isUsedProduct(p)),
  }
}
