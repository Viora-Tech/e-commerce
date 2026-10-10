import { describe, expect, it } from 'vitest'
import { parseTrustedOrigins, UmamiError, umamiClient } from '../src/client'

const SITE = '4f1e2a7c-9b3d-4c5e-8f60-1a2b3c4d5e6f'
const RANGE = { startAt: 1, endAt: 2, days: ['2026-10-01'] }

type Call = { url: string; init: RequestInit }

/** A fake Umami: answers by path (method + pathname), records every call. */
function fakeUmami(routes: Record<string, (url: URL) => Response>) {
  const calls: Call[] = []
  const fn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input))
    calls.push({ url: url.href, init: init ?? {} })
    const route = routes[`${init?.method ?? 'GET'} ${url.pathname}`]
    return route ? route(url) : new Response('{}', { status: 404 })
  }) as typeof fetch
  return { fn, calls }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/** Every host resolves to a public address. */
const lookup = async () => ['93.184.216.34']

describe('umamiClient', () => {
  it('sends the key as a bearer token to the self-hosted API', async () => {
    const umami = fakeUmami({
      [`GET /api/websites/${SITE}`]: () => json({ id: SITE, name: 'Waimers', domain: 'a.in' }),
    })
    const client = umamiClient({
      url: 'https://umami.example',
      apiKey: 'key-1',
      fetch: umami.fn,
      lookup,
    })
    expect(await client.website(SITE)).toEqual({ id: SITE, name: 'Waimers', domain: 'a.in' })
    const headers = umami.calls[0]?.init.headers as Record<string, string>
    expect(headers.authorization).toBe('Bearer key-1')
  })

  it('uses api.umami.is for Umami Cloud', async () => {
    const umami = fakeUmami({ [`GET /v1/websites/${SITE}`]: () => json({ id: SITE }) })
    await umamiClient({
      url: 'https://cloud.umami.is',
      apiKey: 'k',
      fetch: umami.fn,
      lookup,
    }).website(SITE)
    expect(umami.calls[0]?.url).toBe(`https://api.umami.is/v1/websites/${SITE}`)
  })

  it('creates a website with a POST', async () => {
    const umami = fakeUmami({ 'POST /api/websites': () => json({ id: SITE }) })
    const client = umamiClient({
      url: 'https://umami.example',
      apiKey: 'k',
      fetch: umami.fn,
      lookup,
    })
    expect(await client.createWebsite({ name: 'Waimers', domain: 'waimers.in' })).toEqual({
      id: SITE,
    })
    expect(umami.calls[0]?.init.body).toBe('{"name":"Waimers","domain":"waimers.in"}')
  })

  it.each([
    [401, 'unauthorized'],
    [403, 'unauthorized'],
    [404, 'not-found'],
    [500, 'unreachable'],
  ])('turns HTTP %i into %s', async (status, code) => {
    const umami = fakeUmami({ [`GET /api/websites/${SITE}`]: () => json({}, status) })
    const client = umamiClient({
      url: 'https://umami.example',
      apiKey: 'k',
      fetch: umami.fn,
      lookup,
    })
    await expect(client.website(SITE)).rejects.toMatchObject({ code })
  })

  it('refuses a private address unless the platform trusts it', async () => {
    const umami = fakeUmami({ [`GET /api/websites/${SITE}`]: () => json({ id: SITE }) })
    const local = { url: 'http://umami:3000', apiKey: 'k', fetch: umami.fn }
    await expect(
      umamiClient({ ...local, lookup: async () => ['10.0.0.5'] }).website(SITE),
    ).rejects.toBeInstanceOf(UmamiError)
    expect(umami.calls).toEqual([])
    await umamiClient({ ...local, trustedOrigins: ['http://umami:3000'] }).website(SITE)
    expect(umami.calls).toHaveLength(1)
  })

  it('builds a report, falling back to Umami 2 names and skipping lists Umami lacks', async () => {
    const metrics = (url: URL) => {
      const type = url.searchParams.get('type')
      if (type === 'path' || type === 'utmCampaign') return json({ error: 'bad type' }, 400)
      if (type === 'url') return json([{ x: '/home', y: 5 }])
      return json([{ x: `${type}-1`, y: 2 }])
    }
    const umami = fakeUmami({
      [`GET /api/websites/${SITE}/stats`]: () =>
        json({ pageviews: 9, visitors: 3, visits: 4, bounces: 2, totaltime: 40 }),
      [`GET /api/websites/${SITE}/pageviews`]: () =>
        json({
          pageviews: [{ x: '2026-10-01 00:00:00', y: 9 }],
          sessions: [{ x: '2026-10-01 00:00:00', y: 3 }],
        }),
      [`GET /api/websites/${SITE}/metrics`]: metrics,
    })
    const client = umamiClient({
      url: 'https://umami.example',
      apiKey: 'k',
      fetch: umami.fn,
      lookup,
    })
    const report = await client.report(SITE, RANGE, 'Asia/Kolkata')
    expect(report.visitors).toEqual([3])
    expect(report.pageviews).toEqual([9])
    expect(report.kpis.find((k) => k.id === 'visitors')?.value).toBe(3)
    expect(report.breakdowns.pages).toEqual([{ label: '/home', count: 5, share: 1 }])
    expect(report.breakdowns.campaigns).toEqual([])
    expect(report.breakdowns.countries[0]?.label).toBe('country-1')
    const trend = umami.calls.find((c) => c.url.includes('/pageviews'))
    expect(trend?.url).toContain('unit=day')
    expect(trend?.url).toContain('timezone=Asia%2FKolkata')
  })
})

describe('parseTrustedOrigins', () => {
  it('keeps valid origins only', () => {
    expect(parseTrustedOrigins(' http://umami:3000/ ,nonsense, https://a.example/x')).toEqual([
      'http://umami:3000',
      'https://a.example',
    ])
    expect(parseTrustedOrigins(undefined)).toEqual([])
  })
})
