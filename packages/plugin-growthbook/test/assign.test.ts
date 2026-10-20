import { webcrypto } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  type Assignments,
  assignmentsKey,
  featureEvaluator,
  liquidExperiments,
  NO_ASSIGNMENTS,
  ttlCache,
  variantMatches,
} from '../src/assign'

/** A feature with a 50/50 experiment rule, as GrowthBook's features endpoint sends it. */
const features = (coverage = 1) => ({
  hero: {
    defaultValue: 'control',
    rules: [
      {
        key: 'hero-test',
        variations: ['control', 'big-banner'],
        weights: [0.5, 0.5],
        coverage,
        hashAttribute: 'id',
        hashVersion: 2,
        seed: 'hero-test',
        phase: '0',
        meta: [
          { key: '0', name: 'Control' },
          { key: '1', name: 'Big banner' },
        ],
      },
    ],
  },
  'free-shipping-note': { defaultValue: true },
})

const ids = Array.from(
  { length: 200 },
  (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
)

describe('featureEvaluator', () => {
  it('assigns every shopper one variation, the same one every time, and splits traffic', async () => {
    const gb = await featureEvaluator({ features: features() })
    const seen = new Set<number>()
    for (const id of ids) {
      const a = gb.assign(id)['hero-test']
      expect(a).toBeDefined()
      expect(gb.assign(id)['hero-test']).toEqual(a)
      seen.add(a?.variationId ?? -1)
    }
    expect([...seen].sort()).toEqual([0, 1])
  })

  it('names the variation as GrowthBook does', async () => {
    const gb = await featureEvaluator({ features: features() })
    const all = ids.map((id) => gb.assign(id)['hero-test'])
    expect(all.find((a) => a?.variationId === 1)).toEqual({
      key: 'hero-test',
      variationId: 1,
      variationKey: '1',
      name: 'Big banner',
    })
  })

  it('leaves out shoppers outside the experiment’s traffic and plain flags', async () => {
    const gb = await featureEvaluator({ features: features(0) })
    for (const id of ids.slice(0, 20)) expect(gb.assign(id)).toEqual({})
  })

  it('reads an encrypted SDK connection with its decryption key', async () => {
    const raw = await webcrypto.subtle.generateKey({ name: 'AES-CBC', length: 128 }, true, [
      'encrypt',
    ])
    const key = Buffer.from(await webcrypto.subtle.exportKey('raw', raw)).toString('base64')
    const iv = webcrypto.getRandomValues(new Uint8Array(16))
    const cipher = await webcrypto.subtle.encrypt(
      { name: 'AES-CBC', iv },
      raw,
      new TextEncoder().encode(JSON.stringify(features())),
    )
    const encryptedFeatures = `${Buffer.from(iv).toString('base64')}.${Buffer.from(cipher).toString('base64')}`
    const gb = await featureEvaluator({ encryptedFeatures }, key)
    expect(gb.assign(ids[0] as string)['hero-test']).toBeDefined()
  })
})

const assigned = (variationId: number, name = ''): Assignments => ({
  'hero-test': { key: 'hero-test', variationId, variationKey: String(variationId), name },
})

describe('variantMatches', () => {
  it('shows a section without an experiment to everyone', () => {
    expect(variantMatches({ key: '', variant: '1' }, NO_ASSIGNMENTS)).toBe(true)
    expect(variantMatches({ key: '  ', variant: '' }, assigned(1))).toBe(true)
  })

  it('shows the variant’s section only to its shoppers', () => {
    const gate = { key: 'hero-test', variant: '1' }
    expect(variantMatches(gate, assigned(1))).toBe(true)
    expect(variantMatches(gate, assigned(0))).toBe(false)
  })

  it('reads the variant as a number, key, name or "control", any case', () => {
    expect(
      variantMatches({ key: 'hero-test', variant: 'Big Banner' }, assigned(1, 'Big banner')),
    ).toBe(true)
    expect(variantMatches({ key: 'hero-test', variant: 'control' }, assigned(0))).toBe(true)
    expect(variantMatches({ key: 'hero-test', variant: 'CONTROL' }, assigned(1))).toBe(false)
    expect(variantMatches({ key: 'hero-test', variant: '' }, assigned(0))).toBe(true)
  })

  it('shows shoppers outside the experiment the control', () => {
    expect(variantMatches({ key: 'hero-test', variant: '0' }, NO_ASSIGNMENTS)).toBe(true)
    expect(variantMatches({ key: 'hero-test', variant: 'control' }, NO_ASSIGNMENTS)).toBe(true)
    expect(variantMatches({ key: 'hero-test', variant: '1' }, NO_ASSIGNMENTS)).toBe(false)
  })

  it('never reads inherited keys as experiments', () => {
    expect(variantMatches({ key: 'toString', variant: '1' }, NO_ASSIGNMENTS)).toBe(false)
  })
})

describe('Liquid and cache keys', () => {
  const two: Assignments = {
    b: { key: 'b', variationId: 0, variationKey: '0', name: '' },
    a: { key: 'a', variationId: 2, variationKey: '2', name: '' },
  }

  it('gives Liquid each experiment’s variation number', () => {
    expect(liquidExperiments(two)).toEqual({ a: 2, b: 0 })
  })

  it('labels assignments the same whatever their order', () => {
    expect(assignmentsKey(two)).toBe('a=2;b=0')
    expect(assignmentsKey(NO_ASSIGNMENTS)).toBe('')
  })
})

describe('ttlCache', () => {
  it('loads once per key within the time, again after it', async () => {
    let t = 0
    let loads = 0
    const cache = ttlCache<number>(60_000, () => t)
    const load = async () => ++loads
    expect(await cache.get('s1', load)).toBe(1)
    expect(await cache.get('s1', load)).toBe(1)
    t = 60_000
    expect(await cache.get('s1', load)).toBe(2)
  })

  it('remembers a failed load as null for the same time', async () => {
    let calls = 0
    const cache = ttlCache<number>(60_000, () => 0)
    const fail = async () => {
      calls++
      throw new Error('down')
    }
    expect(await cache.get('s1', fail)).toBeNull()
    expect(await cache.get('s1', fail)).toBeNull()
    expect(calls).toBe(1)
  })
})
