/** SOURCE OF TRUTH: store health — WHAT the checks are (shipping, products, payments, store), how bad each problem is and the order they are listed in / WHY: a setup that silently breaks checkout (Waimers, 2026-10-21: two imported shipping zones with no rates made checkout say "We do not ship to <PIN>" for every address) must be told to the merchant with a way to fix it */
import { missingRequiredPolicies, type PolicyType } from '../policies/client'
import { INDIAN_STATE_NAMES } from '../tax/states'

/*
 * Pure: no database, no clock of its own, so the admin (Home card, Settings → Store health,
 * the Shopify import summary) imports the types through `@commerce/core/store-health` and the
 * tests feed facts straight in. The API's store-health service reads the facts.
 */

/** Worst first: the order the list and the Home card read in. */
export const HEALTH_SEVERITIES = ['blocks_checkout', 'should_fix', 'nice_to_have'] as const
export type HealthSeverity = (typeof HEALTH_SEVERITIES)[number]

export const HEALTH_AREAS = ['shipping', 'payments', 'products', 'store'] as const
export type HealthArea = (typeof HEALTH_AREAS)[number]

type Base = {
  /** Unique within one report, for list keys. */
  key: string
  area: HealthArea
  severity: HealthSeverity
}

export type HealthIssue = Base &
  (
    | { code: 'zone_no_rates'; zoneId: string; zoneName: string }
    | { code: 'zones_overlap'; zoneIds: string[]; zoneNames: string[] }
    | { code: 'states_uncovered'; stateCodes: string[] }
    | { code: 'no_origin_pincode' }
    | { code: 'no_courier' }
    | { code: 'variants_no_weight'; variants: number; products: number }
    | { code: 'products_no_price'; products: number }
    | { code: 'products_no_image'; products: number }
    | { code: 'no_payment_method' }
    | { code: 'no_online_payment' }
    | { code: 'gateway_test_mode'; gateway: string }
    | { code: 'webhook_missing'; gateway: string; paid: boolean }
    | { code: 'policies_missing'; policies: PolicyType[] }
    | { code: 'sender_unverified'; email: string; status: 'pending' | 'failed' }
    | { code: 'no_sender_email' }
  )

export type HealthIssueCode = HealthIssue['code']

export type StoreHealthReport = {
  /** Worst first, then by area. */
  issues: HealthIssue[]
  counts: Record<HealthSeverity, number>
  checkedAt: string
}

// ── Shipping ────────────────────────────────────────────────────────────────

export type HealthZone = {
  id: string
  name: string
  countryCodes: readonly string[]
  stateCodes: readonly string[]
  pincodeRules: readonly { pattern: string; mode: 'include' | 'exclude' }[]
  rateCount: number
}

export type ShippingHealthFacts = {
  zones: readonly HealthZone[]
  /** Settings → Shipping's origin PIN code as saved; null when never saved. */
  originPincode: string | null
  /** Couriers switched on, the built-in demo courier left out. */
  couriers: readonly string[]
}

/** Every state and union territory, in code order. */
const ALL_STATES = Object.keys(INDIAN_STATE_NAMES).sort()

/** An Indian PIN code: six digits, not starting with 0. */
const PINCODE = /^[1-9][0-9]{5}$/

const inIndia = (z: HealthZone) => z.countryCodes.length === 0 || z.countryCodes.includes('IN')

/** A zone with no states and no include rules covers the whole of India (rates.ts `zoneScore`). */
const coversEverywhere = (z: HealthZone) =>
  z.stateCodes.length === 0 && !z.pincodeRules.some((r) => r.mode === 'include')

/** Two zones with the same key cover exactly the same addresses. */
function coverageKey(z: HealthZone): string {
  const states = [...z.stateCodes].map((s) => s.toUpperCase()).sort()
  const rules = z.pincodeRules.map((r) => `${r.mode}:${r.pattern}`).sort()
  const countries = [...(z.countryCodes.length ? z.countryCodes : ['IN'])].sort()
  return `${countries.join(',')}|${states.join(',')}|${rules.join(',')}`
}

/**
 * Zones with no rates, zones that cover exactly the same places, states no zone with a rate
 * reaches, no origin PIN code, no courier. With no zones at all shipping is free everywhere
 * (`quoteShipping` → not_configured), so coverage is only checked once a zone exists.
 */
export function shippingChecks(facts: ShippingHealthFacts): HealthIssue[] {
  const issues: HealthIssue[] = []
  for (const z of facts.zones) {
    if (z.rateCount > 0) continue
    issues.push({
      key: `zone_no_rates:${z.id}`,
      area: 'shipping',
      severity: 'should_fix',
      code: 'zone_no_rates',
      zoneId: z.id,
      zoneName: z.name,
    })
  }

  const groups = new Map<string, HealthZone[]>()
  for (const z of facts.zones) {
    const key = coverageKey(z)
    groups.set(key, [...(groups.get(key) ?? []), z])
  }
  for (const same of groups.values()) {
    if (same.length < 2) continue
    issues.push({
      key: `zones_overlap:${same.map((z) => z.id).join(',')}`,
      area: 'shipping',
      severity: 'should_fix',
      code: 'zones_overlap',
      zoneIds: same.map((z) => z.id),
      zoneNames: same.map((z) => z.name),
    })
  }

  const india = facts.zones.filter(inIndia)
  const withRates = india.filter((z) => z.rateCount > 0)
  if (india.length > 0 && !withRates.some(coversEverywhere)) {
    const covered = new Set(withRates.flatMap((z) => z.stateCodes.map((s) => s.toUpperCase())))
    const missing = ALL_STATES.filter((s) => !covered.has(s))
    if (missing.length) {
      issues.push({
        key: 'states_uncovered',
        area: 'shipping',
        severity: 'blocks_checkout',
        code: 'states_uncovered',
        stateCodes: missing,
      })
    }
  }

  if (!facts.originPincode || !PINCODE.test(facts.originPincode)) {
    issues.push({
      key: 'no_origin_pincode',
      area: 'shipping',
      severity: 'should_fix',
      code: 'no_origin_pincode',
    })
  }
  if (facts.couriers.length === 0) {
    issues.push({ key: 'no_courier', area: 'shipping', severity: 'should_fix', code: 'no_courier' })
  }
  return issues
}

// ── Products ────────────────────────────────────────────────────────────────

export type ProductHealthFacts = {
  /** Live variants of active, shipped products with no weight (or 0 g). */
  variantsNoWeight: number
  /** The active products those variants belong to. */
  productsNoWeight: number
  /** Active products with a variant shoppers can see priced at ₹0 (gift cards and hidden variants left out). */
  productsNoPrice: number
  /** Active products without a single image. */
  productsNoImage: number
}

/** Weightless variants (wrong weight-based rates and courier quotes), ₹0 prices, no images. */
export function productChecks(facts: ProductHealthFacts): HealthIssue[] {
  const issues: HealthIssue[] = []
  if (facts.variantsNoWeight > 0) {
    issues.push({
      key: 'variants_no_weight',
      area: 'products',
      severity: 'should_fix',
      code: 'variants_no_weight',
      variants: facts.variantsNoWeight,
      products: facts.productsNoWeight,
    })
  }
  if (facts.productsNoPrice > 0) {
    issues.push({
      key: 'products_no_price',
      area: 'products',
      severity: 'should_fix',
      code: 'products_no_price',
      products: facts.productsNoPrice,
    })
  }
  if (facts.productsNoImage > 0) {
    issues.push({
      key: 'products_no_image',
      area: 'products',
      severity: 'nice_to_have',
      code: 'products_no_image',
      products: facts.productsNoImage,
    })
  }
  return issues
}

// ── Payments ────────────────────────────────────────────────────────────────

export type HealthGateway = {
  /** Provider id (`razorpay`, `cashfree`, `decentro`). */
  id: string
  /** Display name for the merchant. */
  name: string
  /** The key set checkout uses; null when no keys are saved. */
  mode: 'test' | 'live' | null
  lastEventAt: Date | null
  lastCapturedAt: Date | null
}

export type PaymentHealthFacts = {
  /** Providers on at checkout (`cod`, `manual`, `razorpay`…); switched-off gateways excluded. */
  enabled: readonly string[]
  /** Online methods (UPI, cards…) switched on in "Shoppers can pay with". */
  onlineMethodsOn: number
  /** The gateways among `enabled`. */
  gateways: readonly HealthGateway[]
}

const OFFLINE = new Set(['cod', 'manual'])

/** How long after a captured payment its webhook may still be on the way. */
export const WEBHOOK_GRACE_MS = 15 * 60_000

/**
 * Nothing to pay with (blocks checkout), a gateway on test keys (shoppers' payments are not
 * real, so it blocks real orders), no live online gateway (cash only), and a live gateway that
 * never sent a webhook: worse once a payment was captured without one, since its later updates
 * (refunds, late captures) will not arrive either.
 */
export function paymentChecks(facts: PaymentHealthFacts, now: Date): HealthIssue[] {
  const issues: HealthIssue[] = []
  if (facts.enabled.length === 0) {
    issues.push({
      key: 'no_payment_method',
      area: 'payments',
      severity: 'blocks_checkout',
      code: 'no_payment_method',
    })
    return issues
  }
  for (const g of facts.gateways) {
    if (g.mode !== 'test') continue
    issues.push({
      key: `gateway_test_mode:${g.id}`,
      area: 'payments',
      severity: 'blocks_checkout',
      code: 'gateway_test_mode',
      gateway: g.name,
    })
  }
  const live = facts.gateways.filter((g) => g.mode === 'live')
  const online = facts.enabled.some((id) => !OFFLINE.has(id))
  const anyTest = facts.gateways.some((g) => g.mode === 'test')
  if (!anyTest && (!online || live.length === 0 || facts.onlineMethodsOn === 0)) {
    issues.push({
      key: 'no_online_payment',
      area: 'payments',
      severity: 'should_fix',
      code: 'no_online_payment',
    })
  }
  for (const g of live) {
    if (g.lastEventAt) continue
    const paid = !!g.lastCapturedAt && now.getTime() - g.lastCapturedAt.getTime() > WEBHOOK_GRACE_MS
    issues.push({
      key: `webhook_missing:${g.id}`,
      area: 'payments',
      severity: paid ? 'should_fix' : 'nice_to_have',
      code: 'webhook_missing',
      gateway: g.name,
      paid,
    })
  }
  return issues
}

// ── Store ───────────────────────────────────────────────────────────────────

export type StoreHealthFacts = {
  /** Policies published on the storefront. */
  publishedPolicies: readonly PolicyType[]
  /** The store's own sender address; null when none was added. */
  sender: { email: string; status: 'pending' | 'verified' | 'failed' } | null
}

/** Required policies not published, and a sender address that is not verified (or none). */
export function storeChecks(facts: StoreHealthFacts): HealthIssue[] {
  const issues: HealthIssue[] = []
  const missing = missingRequiredPolicies(facts.publishedPolicies)
  if (missing.length) {
    issues.push({
      key: 'policies_missing',
      area: 'store',
      severity: 'should_fix',
      code: 'policies_missing',
      policies: missing,
    })
  }
  if (!facts.sender) {
    issues.push({
      key: 'no_sender_email',
      area: 'store',
      severity: 'nice_to_have',
      code: 'no_sender_email',
    })
  } else if (facts.sender.status !== 'verified') {
    issues.push({
      key: 'sender_unverified',
      area: 'store',
      severity: 'should_fix',
      code: 'sender_unverified',
      email: facts.sender.email,
      status: facts.sender.status,
    })
  }
  return issues
}

// ── Report ──────────────────────────────────────────────────────────────────

export type StoreHealthInput = {
  shipping: ShippingHealthFacts
  products: ProductHealthFacts
  payments: PaymentHealthFacts
  store: StoreHealthFacts
}

const rank = (i: HealthIssue) =>
  HEALTH_SEVERITIES.indexOf(i.severity) * 10 + HEALTH_AREAS.indexOf(i.area)

/** Every check, worst first, with a count per severity. */
export function storeHealthReport(input: StoreHealthInput, now: Date): StoreHealthReport {
  const issues = [
    ...shippingChecks(input.shipping),
    ...paymentChecks(input.payments, now),
    ...productChecks(input.products),
    ...storeChecks(input.store),
  ]
    .map((issue, i) => ({ issue, i }))
    .sort((a, b) => rank(a.issue) - rank(b.issue) || a.i - b.i)
    .map(({ issue }) => issue)
  const counts = { blocks_checkout: 0, should_fix: 0, nice_to_have: 0 }
  for (const i of issues) counts[i.severity] += 1
  return { issues, counts, checkedAt: now.toISOString() }
}
