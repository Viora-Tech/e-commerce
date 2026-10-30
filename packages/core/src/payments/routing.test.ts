import { describe, expect, it } from 'vitest'
import type { CheckoutMethod } from './methods'
import { activateGateway, deactivateGateway } from './modes'
import {
  activeGatewaysOf,
  cleanRouting,
  enabledForGateways,
  fallbackChain,
  type GatewaySupports,
  methodsForGateway,
  routeMethods,
} from './routing'

const ALL_ON: CheckoutMethod[] = [
  { id: 'upi', on: true },
  { id: 'card', on: true },
  { id: 'netbanking', on: true },
  { id: 'wallet', on: false },
  { id: 'emi', on: false },
  { id: 'cod', on: true },
]

/** Decentro-like gateway that only takes UPI, for the "cannot take it" cases. */
const supports: GatewaySupports = (id) => (id === 'cashfree' ? ['upi'] : undefined)

describe('routing: a store that never saved one', () => {
  const legacy = { enabled: ['razorpay', 'cod'], methods: ALL_ON }

  it('sends every method to the main gateway', () => {
    expect(routeMethods(legacy)).toEqual({
      upi: 'razorpay',
      card: 'razorpay',
      netbanking: 'razorpay',
      wallet: 'razorpay',
      emi: 'razorpay',
    })
    expect(methodsForGateway(legacy, 'razorpay')).toEqual(['upi', 'card', 'netbanking'])
  })

  it('leaves the gateway window alone when the method row was never saved either', () => {
    expect(methodsForGateway({ enabled: ['razorpay'] }, 'razorpay')).toBeUndefined()
  })

  it('never falls back', () => {
    expect(fallbackChain(legacy, 'razorpay', ['upi'])).toEqual([])
  })
})

describe('routing: two gateways together', () => {
  const both = {
    enabled: ['cashfree', 'razorpay', 'cod'],
    methods: ALL_ON,
    routing: { order: ['razorpay', 'cashfree'], methods: { upi: 'cashfree' } },
  }

  it('orders active gateways by the saved order, skipping ones switched off', () => {
    expect(activeGatewaysOf(both)).toEqual(['razorpay', 'cashfree'])
    expect(activeGatewaysOf({ ...both, inactive: { cashfree: ['cashfree'] } })).toEqual([
      'razorpay',
    ])
  })

  it('routes picked methods to their gateway and the rest to the first active one', () => {
    expect(routeMethods(both)).toMatchObject({ upi: 'cashfree', card: 'razorpay' })
    expect(methodsForGateway(both, 'cashfree')).toEqual(['upi'])
    expect(methodsForGateway(both, 'razorpay')).toEqual(['card', 'netbanking'])
  })

  it('moves a route to the next gateway when its pick is off or cannot take it', () => {
    const off = { ...both, inactive: { cashfree: ['cashfree'] } }
    expect(routeMethods(off).upi).toBe('razorpay')
    const cardsOnCashfree = { ...both, routing: { ...both.routing, methods: { card: 'cashfree' } } }
    expect(routeMethods(cardsOnCashfree, supports).card).toBe('razorpay')
  })

  it('falls back to every other active gateway that takes the offered methods', () => {
    expect(fallbackChain(both, 'cashfree', ['upi'])).toEqual([
      { gatewayId: 'razorpay', methods: ['upi'] },
    ])
    expect(fallbackChain(both, 'razorpay', ['card', 'upi'], supports)).toEqual([
      { gatewayId: 'cashfree', methods: ['upi'] },
    ])
    expect(fallbackChain(both, 'razorpay', ['card'], supports)).toEqual([])
  })

  it('lets a fallback gateway show everything when the window was never narrowed', () => {
    expect(fallbackChain(both, 'razorpay', undefined)).toEqual([
      { gatewayId: 'cashfree', methods: undefined },
    ])
  })
})

describe('cleanRouting', () => {
  it('keeps usable gateways once each and drops routes to gateways that are off or cannot take them', () => {
    const usable = (id: string) => id !== 'decentro'
    expect(
      cleanRouting(
        {
          order: ['cashfree', 'cashfree', 'razorpay', 'decentro', 'paytm'],
          methods: { upi: 'cashfree', card: 'cashfree', wallet: 'paytm' },
        },
        usable,
        supports,
      ),
    ).toEqual({ order: ['cashfree', 'razorpay'], methods: { upi: 'cashfree' } })
  })
})

describe('enabledForGateways', () => {
  it('puts every routed gateway where the online methods sit and keeps the rest after', () => {
    expect(
      enabledForGateways(['cod', 'razorpay', 'manual'], ALL_ON, ['cashfree', 'razorpay']),
    ).toEqual(['cashfree', 'razorpay', 'cod', 'manual'])
  })

  it('drops every gateway when no online method is on', () => {
    const codOnly = ALL_ON.map((m) => ({ ...m, on: m.id === 'cod' }))
    expect(enabledForGateways(['razorpay', 'cod'], codOnly, ['razorpay'])).toEqual(['cod'])
  })
})

describe('activate / deactivate with a saved routing', () => {
  const routed = {
    enabled: ['razorpay', 'cod'],
    methods: ALL_ON,
    inactive: { cashfree: ['cashfree'] },
    routing: { order: ['razorpay'], methods: {} },
  }

  it('switching a gateway on keeps the other one on and puts it last in line', () => {
    const next = activateGateway(routed, 'cashfree', ALL_ON)
    expect(next.enabled).toEqual(['razorpay', 'cashfree', 'cod'])
    expect(next.routing?.order).toEqual(['razorpay', 'cashfree'])
    expect(next.inactive).toEqual({})
  })

  it('without a routing, switching one on still replaces the other (as before)', () => {
    const { routing: _drop, ...legacy } = routed
    const next = activateGateway(legacy, 'cashfree', ALL_ON)
    expect(next.enabled).toEqual(['cashfree', 'cod'])
    expect(next.inactive).toEqual({ razorpay: ['razorpay'] })
  })

  it('switching a gateway off takes it out of the fallback order', () => {
    const both = activateGateway(routed, 'cashfree', ALL_ON)
    const next = deactivateGateway(both, 'razorpay', ['razorpay', 'razorpay_upi'])
    expect(next.enabled).toEqual(['cashfree', 'cod'])
    expect(next.routing?.order).toEqual(['cashfree'])
  })
})
