import { describe, expect, it } from 'vitest'
import { GrowthbookError, growthbookClient, parseTrustedOrigins, toExperiment } from '../src/client'

type Call = { url: string; init: RequestInit }

/** A fake GrowthBook: answers by pathname, records every call. */
function fakeGrowthbook(routes: Record<string, (url: URL) => Response>) {
  const calls: Call[] = []
  const fn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input))
    calls.push({ url: url.href, init: init ?? {} })
    const route = routes[url.pathname]
    return route ? route(url) : new Response('{}', { status: 404 })
  }) as typeof fetch
  return { fn, calls }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/** Every host resolves to a public address. */
const lookup = async () => ['93.184.216.34']

const EXPERIMENT = {
  id: 'exp_123',
  trackingKey: 'hero-test',
  name: 'Hero banner',
  status: 'running',
  archived: false,
  variations: [
    { variationId: 'var_a', key: '0', name: 'Control' },
    { variationId: 'var_b', key: '1', name: 'Big banner' },
  ],
  phases: [{ name: 'Main', dateStarted: '2026-10-01T00:00:00Z', dateEnded: null }],
}

describe('growthbookClient.features', () => {
  it('reads the SDK connection’s features without any key', async () => {
    const gb = fakeGrowthbook({
      '/api/features/sdk-abc123': () => json({ features: { hero: { defaultValue: 1 } } }),
    })
    const client = growthbookClient({ apiHost: 'https://gb.example', fetch: gb.fn, lookup })
    expect(await client.features('sdk-abc123')).toEqual({ features: { hero: { defaultValue: 1 } } })
    const headers = gb.calls[0]?.init.headers as Record<string, string>
    expect(headers.authorization).toBeUndefined()
  })

  it('accepts an encrypted payload', async () => {
    const gb = fakeGrowthbook({
      '/api/features/sdk-abc123': () => json({ encryptedFeatures: 'iv.cipher' }),
    })
    const client = growthbookClient({ apiHost: 'https://gb.example', fetch: gb.fn, lookup })
    expect(await client.features('sdk-abc123')).toEqual({ encryptedFeatures: 'iv.cipher' })
  })

  it('refuses an answer that is not a features payload', async () => {
    const gb = fakeGrowthbook({ '/api/features/sdk-abc123': () => json({ hello: 1 }) })
    const client = growthbookClient({ apiHost: 'https://gb.example', fetch: gb.fn, lookup })
    await expect(client.features('sdk-abc123')).rejects.toMatchObject({ code: 'bad-response' })
  })

  it('reaches a trusted private origin with a plain fetch', async () => {
    const gb = fakeGrowthbook({ '/api/features/sdk-abc123': () => json({ features: {} }) })
    const client = growthbookClient({
      apiHost: 'http://growthbook:3100',
      trustedOrigins: ['http://growthbook:3100'],
      fetch: gb.fn,
      lookup: async () => ['10.0.0.5'],
    })
    expect(await client.features('sdk-abc123')).toEqual({ features: {} })
  })

  it('never reaches a private address it was not told to trust', async () => {
    const gb = fakeGrowthbook({ '/api/features/sdk-abc123': () => json({ features: {} }) })
    const client = growthbookClient({
      apiHost: 'https://gb.example',
      fetch: gb.fn,
      lookup: async () => ['10.0.0.5'],
    })
    await expect(client.features('sdk-abc123')).rejects.toMatchObject({ code: 'unreachable' })
    expect(gb.calls).toHaveLength(0)
  })
})

describe('growthbookClient.experiments', () => {
  it('sends the secret key as a bearer token and lists running experiments first', async () => {
    const gb = fakeGrowthbook({
      '/api/v1/experiments': () =>
        json({
          experiments: [
            { ...EXPERIMENT, id: 'exp_old', status: 'stopped', resultSummary: { status: 'won' } },
            EXPERIMENT,
            'junk',
          ],
        }),
    })
    const client = growthbookClient({ apiHost: 'https://gb.example', fetch: gb.fn, lookup })
    const list = await client.experiments('secret_abc')
    expect(list.map((e) => e.id)).toEqual(['exp_123', 'exp_old'])
    expect(list[0]).toEqual({
      id: 'exp_123',
      trackingKey: 'hero-test',
      name: 'Hero banner',
      status: 'running',
      archived: false,
      variations: [
        { id: 0, key: '0', name: 'Control' },
        { id: 1, key: '1', name: 'Big banner' },
      ],
      startedAt: '2026-10-01T00:00:00Z',
      result: null,
    })
    expect(list[1]?.result).toBe('won')
    const headers = gb.calls[0]?.init.headers as Record<string, string>
    expect(headers.authorization).toBe('Bearer secret_abc')
    expect(gb.calls[0]?.url).toBe('https://gb.example/api/v1/experiments?limit=100')
  })

  it('uses api.growthbook.io for GrowthBook Cloud', async () => {
    const gb = fakeGrowthbook({ '/api/v1/experiments': () => json({ experiments: [] }) })
    await growthbookClient({
      apiHost: 'https://cdn.growthbook.io',
      fetch: gb.fn,
      lookup,
    }).experiments('k')
    expect(gb.calls[0]?.url).toBe('https://api.growthbook.io/api/v1/experiments?limit=100')
  })

  it.each([
    [401, 'unauthorized'],
    [403, 'unauthorized'],
    [404, 'not-found'],
    [500, 'unreachable'],
  ])('turns HTTP %i into %s', async (status, code) => {
    const gb = fakeGrowthbook({ '/api/v1/experiments': () => json({}, status) })
    const client = growthbookClient({ apiHost: 'https://gb.example', fetch: gb.fn, lookup })
    const err = await client.experiments('k').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(GrowthbookError)
    expect((err as GrowthbookError).code).toBe(code)
  })
})

describe('toExperiment', () => {
  it('falls back to the id for a missing tracking key and name, and to draft', () => {
    expect(toExperiment({ id: 'exp_9', status: 'paused' })).toMatchObject({
      trackingKey: 'exp_9',
      name: 'exp_9',
      status: 'draft',
      variations: [],
      startedAt: null,
    })
    expect(toExperiment({ name: 'no id' })).toBeNull()
  })
})

describe('parseTrustedOrigins', () => {
  it('keeps origins only', () => {
    expect(parseTrustedOrigins('http://growthbook:3100/api, nonsense,https://gb.local')).toEqual([
      'http://growthbook:3100',
      'https://gb.local',
    ])
    expect(parseTrustedOrigins(undefined)).toEqual([])
  })
})
