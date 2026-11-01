/** SOURCE OF TRUTH: store health check tests — one block per check, plus the report's order and counts */
import { describe, expect, it } from 'vitest'
import { POLICY_TYPES } from '../policies/client'
import { INDIAN_STATE_NAMES } from '../tax/states'
import {
  type HealthGateway,
  type HealthZone,
  type PaymentHealthFacts,
  paymentChecks,
  productChecks,
  type ShippingHealthFacts,
  shippingChecks,
  storeChecks,
  storeHealthReport,
  WEBHOOK_GRACE_MS,
} from './checks'

const ALL = Object.keys(INDIAN_STATE_NAMES)
const NOW = new Date('2026-10-29T10:00:00Z')

const zone = (over: Partial<HealthZone> = {}): HealthZone => ({
  id: 'z1',
  name: 'Everywhere',
  countryCodes: ['IN'],
  stateCodes: [],
  pincodeRules: [],
  rateCount: 1,
  ...over,
})

const shipping = (over: Partial<ShippingHealthFacts> = {}): ShippingHealthFacts => ({
  zones: [zone()],
  originPincode: '560001',
  couriers: ['delhivery'],
  ...over,
})

const codes = (issues: { code: string }[]) => issues.map((i) => i.code)

describe('shippingChecks', () => {
  it('is quiet for a healthy setup', () => {
    expect(shippingChecks(shipping())).toEqual([])
  })

  it('flags a zone with no rates', () => {
    const issues = shippingChecks(
      shipping({
        zones: [zone(), zone({ id: 'z2', name: 'Metro', stateCodes: ['KA'], rateCount: 0 })],
      }),
    )
    expect(issues).toEqual([
      expect.objectContaining({ code: 'zone_no_rates', zoneId: 'z2', zoneName: 'Metro' }),
    ])
    expect(issues[0]?.severity).toBe('should_fix')
  })

  it('flags zones that cover exactly the same places, whatever the order of states', () => {
    const issues = shippingChecks(
      shipping({
        zones: [
          zone(),
          zone({ id: 'a', name: 'South', stateCodes: ['KA', 'TN'] }),
          zone({ id: 'b', name: 'South 2', stateCodes: ['TN', 'ka'] }),
        ],
      }),
    )
    expect(issues).toEqual([
      expect.objectContaining({
        code: 'zones_overlap',
        zoneIds: ['a', 'b'],
        zoneNames: ['South', 'South 2'],
      }),
    ])
  })

  it('does not call zones with different PIN rules an overlap', () => {
    const issues = shippingChecks(
      shipping({
        zones: [
          zone(),
          zone({ id: 'a', stateCodes: ['KA'] }),
          zone({
            id: 'b',
            stateCodes: ['KA'],
            pincodeRules: [{ pattern: '560*', mode: 'include' }],
          }),
        ],
      }),
    )
    expect(codes(issues)).not.toContain('zones_overlap')
  })

  it('reproduces Waimers 2026-10-21: empty all-state zones, rate only on everywhere', () => {
    const issues = shippingChecks(
      shipping({
        zones: [
          zone({ id: 'a', name: 'All India', stateCodes: ALL, rateCount: 0 }),
          zone({ id: 'b', name: 'All India', stateCodes: ALL, rateCount: 0 }),
          zone({ id: 'c', name: 'Rest' }),
        ],
      }),
    )
    expect(codes(issues)).toEqual(['zone_no_rates', 'zone_no_rates', 'zones_overlap'])
  })

  it('blocks checkout when only empty zones cover the states', () => {
    const issues = shippingChecks(
      shipping({ zones: [zone({ id: 'a', stateCodes: ALL, rateCount: 0 })] }),
    )
    const uncovered = issues.find((i) => i.code === 'states_uncovered')
    expect(uncovered?.severity).toBe('blocks_checkout')
    expect(uncovered && 'stateCodes' in uncovered ? uncovered.stateCodes.length : 0).toBe(
      ALL.length,
    )
  })

  it('lists the states no zone with a rate reaches', () => {
    const rest = ALL.filter((s) => s !== 'LA' && s !== 'LD')
    const issues = shippingChecks(shipping({ zones: [zone({ stateCodes: rest })] }))
    expect(issues).toEqual([
      expect.objectContaining({ code: 'states_uncovered', stateCodes: ['LA', 'LD'] }),
    ])
  })

  it('skips coverage when the store has no zones (shipping is free) or only foreign zones', () => {
    expect(codes(shippingChecks(shipping({ zones: [] })))).toEqual([])
    const abroad = zone({ countryCodes: ['US'], stateCodes: ['KA'] })
    expect(codes(shippingChecks(shipping({ zones: [abroad] })))).toEqual([])
  })

  it('flags a missing or broken origin PIN code', () => {
    expect(codes(shippingChecks(shipping({ originPincode: null })))).toEqual(['no_origin_pincode'])
    expect(codes(shippingChecks(shipping({ originPincode: '12345' })))).toEqual([
      'no_origin_pincode',
    ])
  })

  it('flags no courier', () => {
    expect(codes(shippingChecks(shipping({ couriers: [] })))).toEqual(['no_courier'])
  })
})

describe('productChecks', () => {
  const none = { variantsNoWeight: 0, productsNoWeight: 0, productsNoPrice: 0, productsNoImage: 0 }

  it('is quiet when every product is complete', () => {
    expect(productChecks(none)).toEqual([])
  })

  it('counts weightless variants and their products', () => {
    expect(productChecks({ ...none, variantsNoWeight: 7, productsNoWeight: 3 })).toEqual([
      expect.objectContaining({
        code: 'variants_no_weight',
        variants: 7,
        products: 3,
        severity: 'should_fix',
      }),
    ])
  })

  it('counts products priced at zero', () => {
    expect(productChecks({ ...none, productsNoPrice: 2 })).toEqual([
      expect.objectContaining({ code: 'products_no_price', products: 2, severity: 'should_fix' }),
    ])
  })

  it('counts products without an image as nice to have', () => {
    expect(productChecks({ ...none, productsNoImage: 4 })).toEqual([
      expect.objectContaining({ code: 'products_no_image', products: 4, severity: 'nice_to_have' }),
    ])
  })
})

describe('paymentChecks', () => {
  const gateway = (over: Partial<HealthGateway> = {}): HealthGateway => ({
    id: 'razorpay',
    name: 'Razorpay',
    mode: 'live',
    lastEventAt: new Date('2026-10-28T10:00:00Z'),
    lastCapturedAt: new Date('2026-10-28T09:59:00Z'),
    ...over,
  })
  const payments = (over: Partial<PaymentHealthFacts> = {}): PaymentHealthFacts => ({
    enabled: ['razorpay', 'cod'],
    onlineMethodsOn: 3,
    gateways: [gateway()],
    ...over,
  })

  it('is quiet for a live gateway that sends webhooks', () => {
    expect(paymentChecks(payments(), NOW)).toEqual([])
  })

  it('blocks checkout when nothing is switched on', () => {
    expect(paymentChecks(payments({ enabled: [], gateways: [] }), NOW)).toEqual([
      expect.objectContaining({ code: 'no_payment_method', severity: 'blocks_checkout' }),
    ])
  })

  it('flags cash only as should fix', () => {
    expect(paymentChecks(payments({ enabled: ['cod'], gateways: [] }), NOW)).toEqual([
      expect.objectContaining({ code: 'no_online_payment', severity: 'should_fix' }),
    ])
  })

  it('flags a gateway with every online method switched off', () => {
    expect(codes(paymentChecks(payments({ onlineMethodsOn: 0 }), NOW))).toEqual([
      'no_online_payment',
    ])
  })

  it('blocks checkout for a gateway on test keys, without also saying no online payment', () => {
    expect(paymentChecks(payments({ gateways: [gateway({ mode: 'test' })] }), NOW)).toEqual([
      expect.objectContaining({
        code: 'gateway_test_mode',
        gateway: 'Razorpay',
        severity: 'blocks_checkout',
      }),
    ])
  })

  it('nudges about a webhook never received before any payment', () => {
    const g = gateway({ lastEventAt: null, lastCapturedAt: null })
    expect(paymentChecks(payments({ gateways: [g] }), NOW)).toEqual([
      expect.objectContaining({ code: 'webhook_missing', paid: false, severity: 'nice_to_have' }),
    ])
  })

  it('says should fix once a payment was captured without a webhook', () => {
    const g = gateway({
      lastEventAt: null,
      lastCapturedAt: new Date(NOW.getTime() - WEBHOOK_GRACE_MS - 1),
    })
    expect(paymentChecks(payments({ gateways: [g] }), NOW)).toEqual([
      expect.objectContaining({ code: 'webhook_missing', paid: true, severity: 'should_fix' }),
    ])
  })

  it('gives a just-captured payment time for its webhook', () => {
    const g = gateway({ lastEventAt: null, lastCapturedAt: new Date(NOW.getTime() - 60_000) })
    expect(paymentChecks(payments({ gateways: [g] }), NOW)[0]).toMatchObject({ paid: false })
  })
})

describe('storeChecks', () => {
  const verified = { email: 'hi@shop.in', status: 'verified' as const }

  it('is quiet with every policy and a verified sender', () => {
    expect(storeChecks({ publishedPolicies: POLICY_TYPES, sender: verified })).toEqual([])
  })

  it('lists the policies not published', () => {
    expect(
      storeChecks({ publishedPolicies: ['refund-policy', 'privacy-policy'], sender: verified }),
    ).toEqual([
      expect.objectContaining({
        code: 'policies_missing',
        policies: ['terms-of-service', 'shipping-policy', 'contact-information'],
      }),
    ])
  })

  it('flags a live policy that still shows a template gap', () => {
    expect(
      storeChecks({
        publishedPolicies: POLICY_TYPES,
        unfilledPolicies: ['refund-policy'],
        sender: verified,
      }),
    ).toEqual([
      expect.objectContaining({
        code: 'policies_unfilled',
        severity: 'should_fix',
        policies: ['refund-policy'],
      }),
    ])
  })

  it('flags a sender that is not verified yet', () => {
    expect(
      storeChecks({
        publishedPolicies: POLICY_TYPES,
        sender: { email: 'hi@shop.in', status: 'failed' },
      }),
    ).toEqual([
      expect.objectContaining({
        code: 'sender_unverified',
        status: 'failed',
        severity: 'should_fix',
      }),
    ])
  })

  it('suggests adding a sender when there is none', () => {
    expect(storeChecks({ publishedPolicies: POLICY_TYPES, sender: null })).toEqual([
      expect.objectContaining({ code: 'no_sender_email', severity: 'nice_to_have' }),
    ])
  })
})

describe('storeHealthReport', () => {
  it('lists worst first and counts each severity', () => {
    const report = storeHealthReport(
      {
        shipping: shipping({ couriers: [], zones: [zone({ stateCodes: ['KA'] })] }),
        products: {
          variantsNoWeight: 0,
          productsNoWeight: 0,
          productsNoPrice: 0,
          productsNoImage: 2,
        },
        payments: { enabled: ['cod'], onlineMethodsOn: 0, gateways: [] },
        store: { publishedPolicies: POLICY_TYPES, sender: null },
      },
      NOW,
    )
    expect(codes(report.issues)).toEqual([
      'states_uncovered',
      'no_courier',
      'no_online_payment',
      'products_no_image',
      'no_sender_email',
    ])
    expect(report.counts).toEqual({ blocks_checkout: 1, should_fix: 2, nice_to_have: 2 })
    expect(report.checkedAt).toBe(NOW.toISOString())
  })
})
