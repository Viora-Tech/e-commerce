/** SOURCE OF TRUTH: the Delivery options app page's data — WHAT: what the app page shows (the
 * connected courier apps, options, rules, route settings and warnings), the routes the apps
 * answer for a PIN code, and Try a PIN (the cards exactly as checkout would draw them, plus
 * every route's quote and why each won or lost) / WHY: the merchant must see the outcome of
 * their options and rules for any PIN and cart before a shopper does.
 */
import type { StoreTx } from '@commerce/db'
import { parsePincode, type ShippingProvider, servesDestination } from '@commerce/shipping'
import { stateForPincode } from '../../checkout/pincode-state'
import { quoteShipping } from '../rates'
import { loadRateZones } from '../rates-service'
import { type ShippingSettings, toShippingPolicy } from '../settings'
import { quoteDelivery } from './checkout'
import type { DeliveryConfig } from './config'
import type { DeliveryResolveResult } from './resolve-types'
import { AGGREGATOR_PROVIDERS, type Route, routesFromAnswers } from './routes'
import { loadDeliveryConfig, productFacts } from './service'

/** Admin calls wait longer than checkout: the merchant is watching the answer arrive. */
const ADMIN_DEADLINE_MS = 5000

export type ConnectedApp = {
  id: string
  label: string
  channel: 'direct' | 'aggregator'
  prices: boolean
}

export type DeliveryWarning = 'no_options' | 'no_couriers' | 'insurance_unpriced'

export type DeliveryOverview = DeliveryConfig & {
  apps: ConnectedApp[]
  warnings: DeliveryWarning[]
}

/** The connected domestic courier apps checkout would ask. */
function connectedApps(providers: readonly ShippingProvider[]): ConnectedApp[] {
  return providers
    .filter((p) => servesDestination(p, 'IN') && !p.requiresTrackingNumber)
    .map((p) => ({
      id: p.id,
      label: p.label,
      channel: AGGREGATOR_PROVIDERS.has(p.id) ? 'aggregator' : 'direct',
      prices: Boolean(p.quoteOptions || p.quoteRate),
    }))
}

/**
 * Warnings for the page. `insurance_unpriced`: an option insures by default but no route has
 * an insurance rate yet (owner, 29 Oct: Shiprocket and RapidShyp insurance is on, the cost is
 * not known), so insurance is charged at ₹0 until the rate is filled in.
 */
function deliveryWarnings(
  config: DeliveryConfig,
  apps: readonly ConnectedApp[],
): DeliveryWarning[] {
  const out: DeliveryWarning[] = []
  if (config.options.length === 0) out.push('no_options')
  if (apps.length === 0) out.push('no_couriers')
  const insures = config.options.some((o) => o.enabled && o.insurance.default === 'on')
  const priced = config.routeSettings.some(
    (s) => s.insurancePercent != null || s.insuranceMinPaise != null,
  )
  if (insures && !priced) out.push('insurance_unpriced')
  return out
}

export async function deliveryOverview(
  tx: StoreTx,
  providers: readonly ShippingProvider[],
): Promise<DeliveryOverview> {
  const config = await loadDeliveryConfig(tx)
  const apps = connectedApps(providers)
  return { ...config, apps, warnings: deliveryWarnings(config, apps) }
}

export type TryPinInput = {
  pincode: string
  valuePaise: number
  weightGrams: number
  productIds: string[]
  declineInsurance: boolean
}

export type TryPinResult = DeliveryResolveResult & { routes: Route[]; stateCode: string | null }

/** Try a PIN: the options as checkout would show them for this PIN and cart, with the trace. */
export async function tryDeliveryPin(
  tx: StoreTx,
  storeId: string,
  providers: readonly ShippingProvider[],
  settings: ShippingSettings,
  input: TryPinInput,
  now: Date = new Date(),
): Promise<TryPinResult> {
  const parsed = parsePincode(input.pincode)
  if (!parsed.ok) throw new Error('Enter a 6 digit PIN code.')
  const config = await loadDeliveryConfig(tx)
  const stateCode = stateForPincode(parsed.pincode)
  const zone = quoteShipping(
    await loadRateZones(tx),
    { stateCode: stateCode ?? '', pincode: parsed.pincode },
    { valuePaise: input.valuePaise, weightGrams: input.weightGrams },
  )
  const policy = toShippingPolicy(settings)
  const { result, answers } = await quoteDelivery({
    storeId,
    providers,
    config,
    query: {
      originPincode: policy.originPincode,
      destinationPincode: parsed.pincode,
      weightGrams: input.weightGrams,
      valuePaise: input.valuePaise,
    },
    cart: {
      valuePaise: input.valuePaise,
      weightGrams: input.weightGrams,
      items: await productFacts(tx, input.productIds),
    },
    zone,
    policy,
    now,
    declineInsurance: input.declineInsurance,
    deadlineMs: ADMIN_DEADLINE_MS,
  })
  return {
    ...result,
    routes: routesFromAnswers(answers, config.routeSettings, input.weightGrams),
    stateCode,
  }
}
