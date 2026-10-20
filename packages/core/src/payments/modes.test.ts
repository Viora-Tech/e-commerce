import { describe, expect, it } from 'vitest'
import {
  activateGateway,
  checkoutTestMode,
  deactivateGateway,
  gatewayKeySets,
  isGatewayInactive,
  keepReplacedKeySets,
  keySetMode,
  parkedKey,
  switchKeySet,
  withKeySet,
} from './modes'
import {
  builtInPaymentRegistry,
  encryptPaymentSettings,
  maskPaymentSettings,
  parsePaymentSettings,
  resolvePaymentProviders,
} from './settings'

const rzpTest = { keyId: 'rzp_test_abc', keySecret: 'test-secret', webhookSecret: 'wh1' }
const rzpLive = { keyId: 'rzp_live_xyz', keySecret: 'live-secret', webhookSecret: 'wh2' }
const methods = [
  { id: 'upi' as const, on: true },
  { id: 'cod' as const, on: true },
]

describe('keySetMode', () => {
  it('reads Razorpay from the key id prefix, OAuth tokens included', () => {
    expect(keySetMode(rzpTest)).toBe('test')
    expect(keySetMode(rzpLive)).toBe('live')
    expect(keySetMode({ keyId: 'rzp_test_oauth_123', accessToken: 't' })).toBe('test')
    expect(keySetMode({ keyId: 'rzp_live_oauth_123', accessToken: 't' })).toBe('live')
  })

  it("reads Cashfree and Decentro from their mode field; anything but 'live' is the sandbox", () => {
    expect(keySetMode({ appId: 'a', secretKey: 's', mode: 'live' })).toBe('live')
    expect(keySetMode({ appId: 'a', secretKey: 's', mode: 'test' })).toBe('test')
    expect(keySetMode({ appId: 'a', secretKey: 's' })).toBe('test')
    expect(keySetMode({ clientId: 'c', clientSecret: 's', mode: 'live' })).toBe('live')
  })

  it('is null for an empty set or one that says nothing', () => {
    expect(keySetMode(undefined)).toBeNull()
    expect(keySetMode({ keyId: '' })).toBeNull()
    expect(keySetMode({ keyId: 'some_key' })).toBeNull()
  })
})

describe('gatewayKeySets (a store saved before two key sets existed)', () => {
  it('puts the old single Razorpay set in the slot its prefix says, with no migration', () => {
    expect(gatewayKeySets({ razorpay: rzpLive }, 'razorpay')).toEqual({
      active: 'live',
      live: rzpLive,
      test: undefined,
    })
    expect(gatewayKeySets({ razorpay: rzpTest }, 'razorpay')).toEqual({
      active: 'test',
      test: rzpTest,
      live: undefined,
    })
  })

  it('does the same for Cashfree and Decentro by mode', () => {
    const cf = { appId: 'a', secretKey: 's', mode: 'live' }
    expect(gatewayKeySets({ cashfree: cf }, 'cashfree').active).toBe('live')
    const dc = { clientId: 'c', clientSecret: 's', consumerUrn: 'u', mode: 'test' }
    expect(gatewayKeySets({ decentro: dc }, 'decentro')).toMatchObject({ active: 'test', test: dc })
  })

  it('treats a set whose mode it cannot read as live, so real orders are never hidden', () => {
    expect(gatewayKeySets({ razorpay: { keyId: 'odd' } }, 'razorpay').active).toBe('live')
  })

  it('has no active set when nothing is saved', () => {
    expect(gatewayKeySets({}, 'razorpay')).toEqual({
      active: null,
      test: undefined,
      live: undefined,
    })
  })
})

describe('withKeySet and switchKeySet', () => {
  it('saves the first set as the one in use, and the other mode as waiting', () => {
    const a = withKeySet({}, 'razorpay', 'test', rzpTest)
    expect(a).toEqual({ providers: { razorpay: rzpTest }, inUse: true })
    const b = withKeySet(a.providers, 'razorpay', 'live', rzpLive)
    expect(b.inUse).toBe(false)
    expect(b.providers).toEqual({ razorpay: rzpTest, [parkedKey('razorpay', 'live')]: rzpLive })
    expect(gatewayKeySets(b.providers, 'razorpay')).toEqual({
      active: 'test',
      test: rzpTest,
      live: rzpLive,
    })
  })

  it('updates the set in use in place', () => {
    const next = { ...rzpTest, keySecret: 'rotated' }
    const r = withKeySet({ razorpay: rzpTest }, 'razorpay', 'test', next)
    expect(r).toEqual({ providers: { razorpay: next }, inUse: true })
  })

  it('swaps the two sets and never deletes one', () => {
    const both = { razorpay: rzpTest, [parkedKey('razorpay', 'live')]: rzpLive, cod: {} }
    const live = switchKeySet(both, 'razorpay', 'live')
    expect(live).toEqual({
      ok: true,
      providers: { razorpay: rzpLive, [parkedKey('razorpay', 'test')]: rzpTest, cod: {} },
    })
    if (!live.ok) throw new Error('unreachable')
    const back = switchKeySet(live.providers, 'razorpay', 'test')
    expect(back).toEqual({ ok: true, providers: both })
  })

  it('refuses to switch to a mode with no keys, and is a no-op when already there', () => {
    expect(switchKeySet({ razorpay: rzpTest }, 'razorpay', 'live')).toEqual({
      ok: false,
      reason: 'no_keys',
    })
    const same = { razorpay: rzpTest }
    expect(switchKeySet(same, 'razorpay', 'test')).toEqual({ ok: true, providers: same })
  })

  it('keeps the waiting set encrypted and masked like the one in use', () => {
    const s = parsePaymentSettings({
      enabled: ['razorpay'],
      providers: { razorpay: rzpTest, [parkedKey('razorpay', 'live')]: rzpLive },
    })
    const enc = encryptPaymentSettings(s, 'k')
    expect(enc.providers[parkedKey('razorpay', 'live')]?.keySecret).toMatch(/^v2\./)
    expect(maskPaymentSettings(s).providers[parkedKey('razorpay', 'live')]?.keySecret).toBe(
      '••••cret',
    )
  })
})

describe('deactivateGateway and activateGateway', () => {
  it('takes the gateway and its UPI QR off checkout, keeping what was on for later', () => {
    const s = { enabled: ['razorpay', 'cod', 'razorpay_upi'], providers: { razorpay: rzpLive } }
    const off = deactivateGateway(s, 'razorpay', ['razorpay', 'razorpay_upi'])
    expect(off.enabled).toEqual(['cod'])
    expect(off.inactive).toEqual({ razorpay: ['razorpay', 'razorpay_upi'] })
    expect(off.providers).toEqual(s.providers)
    expect(isGatewayInactive(off, 'razorpay')).toBe(true)

    const on = activateGateway(off, 'razorpay', methods)
    expect(on.enabled).toEqual(['razorpay', 'cod', 'razorpay_upi'])
    expect(on.inactive).toEqual({})
    expect(isGatewayInactive(on, 'razorpay')).toBe(false)
  })

  it('switching one main gateway on switches the other off, keys kept', () => {
    const s = { enabled: ['cashfree', 'cod'], inactive: { razorpay: ['razorpay'] } }
    const on = activateGateway(s, 'razorpay', methods)
    expect(on.enabled).toEqual(['razorpay', 'cod'])
    expect(on.inactive).toEqual({ cashfree: ['cashfree'] })
  })

  it('Decentro (UPI only) comes back after the other methods', () => {
    const off = deactivateGateway({ enabled: ['decentro', 'cod'] }, 'decentro', ['decentro'])
    expect(off.enabled).toEqual(['cod'])
    expect(activateGateway(off, 'decentro', methods).enabled).toEqual(['cod', 'decentro'])
  })

  it('checkout skips a switched-off gateway even if enabled still lists it', () => {
    const s = parsePaymentSettings({ enabled: ['cod', 'manual'], inactive: { manual: ['manual'] } })
    const r = resolvePaymentProviders(builtInPaymentRegistry(), s, 'k')
    expect(r.providers.map((p) => p.id)).toEqual(['cod'])
  })
})

describe('keepReplacedKeySets', () => {
  const dcTest = { clientId: 'c1', clientSecret: 's1', consumerUrn: 'u1', mode: 'test' }
  const dcLive = { clientId: 'c2', clientSecret: 's2', consumerUrn: 'u2', mode: 'live' }

  it('parks the replaced set when a save brings keys of the other mode', () => {
    const next = keepReplacedKeySets({ decentro: dcTest }, { decentro: dcLive, cod: {} })
    expect(next).toEqual({ decentro: dcLive, [parkedKey('decentro', 'test')]: dcTest, cod: {} })
  })

  it('leaves a same-mode edit alone and drops a stale waiting copy of the new mode', () => {
    expect(keepReplacedKeySets({ decentro: dcTest }, { decentro: { ...dcTest, clientId: 'x' } }))
      .toEqual({ decentro: { ...dcTest, clientId: 'x' } })
    const before = { decentro: dcTest, [parkedKey('decentro', 'live')]: dcLive }
    const after = { ...before, decentro: { ...dcLive, clientId: 'new' } }
    expect(keepReplacedKeySets(before, after)).toEqual({
      decentro: { ...dcLive, clientId: 'new' },
      [parkedKey('decentro', 'test')]: dcTest,
    })
  })
})

describe('checkoutTestMode', () => {
  it('is on only while a gateway at checkout runs on test keys', () => {
    expect(checkoutTestMode({ enabled: ['razorpay'], providers: { razorpay: rzpTest } })).toBe(true)
    expect(checkoutTestMode({ enabled: ['razorpay'], providers: { razorpay: rzpLive } })).toBe(false)
    expect(checkoutTestMode({ enabled: ['cod'], providers: { razorpay: rzpTest } })).toBe(false)
    expect(
      checkoutTestMode({
        enabled: ['razorpay'],
        providers: { razorpay: rzpTest },
        inactive: { razorpay: ['razorpay'] },
      }),
    ).toBe(false)
  })
})
