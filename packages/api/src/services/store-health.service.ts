import {
  checkoutMethodsOf,
  gatewayKeySets,
  getSenderEmail,
  isGatewayInactive,
  isGatewayProvider,
  listShippingZones,
  MODE_GATEWAY_IDS,
  onlineMethodsOn,
  type PolicyType,
  parsePaymentSettings,
  parseShippingSettings,
  policyTypeOfHandle,
  type StoreHealthReport,
  storeHealthReport,
} from '@commerce/core'
import { getRegistries } from '@commerce/core/registries'
import type { StoreTx } from '@commerce/db'
import { payment, paymentEvent, product, productMedia, variant } from '@commerce/db'
import {
  and,
  count,
  countDistinct,
  desc,
  eq,
  inArray,
  isNull,
  notExists,
  or,
  sql,
} from 'drizzle-orm'
import { listPages } from './page.service'
import { getStore } from './store.service'

/** The demo courier every deployment has; it ships nothing real. */
const DEMO_COURIER = 'fake'

/** Active, real products: gift cards are never shipped, the payment-test product is hidden. */
const sellable = and(
  eq(product.status, 'active'),
  eq(product.isSystemTest, false),
  eq(product.isGiftCard, false),
)

async function productFacts(tx: StoreTx) {
  const [weight] = await tx
    .select({ variants: count(variant.id), products: countDistinct(variant.productId) })
    .from(variant)
    .innerJoin(product, eq(product.id, variant.productId))
    .where(
      and(
        sellable,
        isNull(variant.archivedAt),
        or(isNull(variant.weightGrams), eq(variant.weightGrams, 0)),
      ),
    )
  const [price] = await tx
    .select({ products: countDistinct(variant.productId) })
    .from(variant)
    .innerJoin(product, eq(product.id, variant.productId))
    // Hidden variants (#934) never reach shoppers, so their ₹0 is not a problem.
    .where(
      and(
        sellable,
        isNull(variant.archivedAt),
        eq(variant.hiddenOnStore, false),
        eq(variant.pricePaise, 0),
      ),
    )
  const [image] = await tx
    .select({ products: count() })
    .from(product)
    .where(
      and(
        eq(product.status, 'active'),
        eq(product.isSystemTest, false),
        notExists(
          tx
            .select({ one: sql`1` })
            .from(productMedia)
            .where(eq(productMedia.productId, product.id)),
        ),
      ),
    )
  return {
    variantsNoWeight: weight?.variants ?? 0,
    productsNoWeight: weight?.products ?? 0,
    productsNoPrice: price?.products ?? 0,
    productsNoImage: image?.products ?? 0,
  }
}

async function paymentFacts(tx: StoreTx, raw: unknown) {
  const settings = parsePaymentSettings(raw)
  const registry = getRegistries().payments
  const enabled = settings.enabled.filter((id) => !isGatewayInactive(settings, id))
  const gatewayIds = enabled.filter(
    (id) => isGatewayProvider(id) || (MODE_GATEWAY_IDS as readonly string[]).includes(id),
  )
  // One transaction: the reads run one after another.
  const gateways = []
  for (const id of gatewayIds) {
    // Methods on this gateway's account (Razorpay UPI QR) share its payments and webhook.
    const family = registry.ids().filter((x) => x === id || registry.get(x)?.credentialsFrom === id)
    const [event] = await tx
      .select({ at: paymentEvent.receivedAt })
      .from(paymentEvent)
      .where(eq(paymentEvent.provider, id))
      .orderBy(desc(paymentEvent.receivedAt))
      .limit(1)
    const [captured] = await tx
      .select({ at: payment.createdAt })
      .from(payment)
      .where(
        and(inArray(payment.provider, family), inArray(payment.status, ['captured', 'refunded'])),
      )
      .orderBy(desc(payment.createdAt))
      .limit(1)
    gateways.push({
      id,
      name: registry.get(id)?.label ?? id,
      mode: gatewayKeySets(settings.providers, id).active,
      lastEventAt: event?.at ?? null,
      lastCapturedAt: captured?.at ?? null,
    })
  }
  return {
    enabled,
    onlineMethodsOn: onlineMethodsOn(checkoutMethodsOf(settings)).length,
    gateways,
  }
}

/** Settings → Shipping's origin PIN code as saved; the parser's default does not count. */
export function savedOriginPincode(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null
  const policy = (raw as { policy?: { originPincode?: unknown } }).policy
  return typeof policy?.originPincode === 'string' ? policy.originPincode : null
}

/**
 * Store health: every setup that breaks or hurts checkout and orders, worst first (pure checks
 * in `@commerce/core/store-health`). Settings → Store health, the Home card and the Shopify
 * import summary all read this.
 */
export async function storeHealth(
  tx: StoreTx,
  storeId: string,
  now: Date = new Date(),
): Promise<StoreHealthReport> {
  const s = await getStore(tx, storeId)
  // One transaction: run the reads one after another.
  const zones = await listShippingZones(tx)
  const products = await productFacts(tx)
  const payments = await paymentFacts(tx, s?.payments)
  const pages = await listPages(tx)
  const sender = await getSenderEmail(tx)
  const shipping = parseShippingSettings(s?.shipping)
  const publishedPolicies = pages.flatMap((p): PolicyType[] => {
    const type = p.publishedAt ? policyTypeOfHandle(p.handle) : null
    return type ? [type] : []
  })
  return storeHealthReport(
    {
      shipping: {
        zones: zones.map((z) => ({
          id: z.id,
          name: z.name,
          countryCodes: z.countryCodes,
          stateCodes: z.stateCodes,
          pincodeRules: z.pincodeRules,
          rateCount: z.rates.length,
        })),
        originPincode: savedOriginPincode(s?.shipping),
        couriers: shipping.enabled.filter((id) => id !== DEMO_COURIER),
      },
      products,
      payments,
      store: {
        publishedPolicies,
        sender: sender ? { email: sender.email, status: sender.status } : null,
      },
    },
    now,
  )
}
