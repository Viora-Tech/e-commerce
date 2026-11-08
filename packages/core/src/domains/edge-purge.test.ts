import { describe, expect, it, vi } from 'vitest'
import {
  cloudflarePurgeConfigFrom,
  EdgePurgePlan,
  PURGE_MAX_WAIT_MS,
  PURGE_MIN_GAP_MS,
  PURGE_QUIET_MS,
  PURGE_SOFT_DELAY_MS,
  purgeCloudflareHosts,
  purgeCloudflareZone,
} from './edge-purge'

const config = { apiToken: 'tok', zoneId: 'z'.repeat(32) }

describe('EdgePurgePlan', () => {
  it('purges once the writes have been quiet for a moment', () => {
    const plan = new EdgePurgePlan()
    plan.note('s1', false, 0)
    plan.note('s1', false, 1_000)
    expect(plan.take(1_000 + PURGE_QUIET_MS - 1)).toEqual([])
    expect(plan.take(1_000 + PURGE_QUIET_MS)).toEqual(['s1'])
    expect(plan.size).toBe(0)
  })

  it('does not wait forever while a merchant keeps saving', () => {
    const plan = new EdgePurgePlan()
    for (let t = 0; t <= PURGE_MAX_WAIT_MS; t += 1_000) plan.note('s1', false, t)
    expect(plan.take(PURGE_MAX_WAIT_MS)).toEqual(['s1'])
  })

  it('keeps a gap between two purges of one store', () => {
    const plan = new EdgePurgePlan()
    plan.note('s1', false, 0)
    expect(plan.take(PURGE_QUIET_MS)).toEqual(['s1'])
    plan.note('s1', false, PURGE_QUIET_MS + 1)
    expect(plan.take(PURGE_QUIET_MS * 3)).toEqual([])
    expect(plan.take(PURGE_QUIET_MS + PURGE_MIN_GAP_MS)).toEqual(['s1'])
  })

  it('waits for a soft write to reach the origin first', () => {
    const plan = new EdgePurgePlan()
    plan.note('s1', true, 0)
    expect(plan.take(PURGE_MAX_WAIT_MS)).toEqual([])
    expect(plan.take(PURGE_SOFT_DELAY_MS + PURGE_QUIET_MS)).toEqual(['s1'])
  })

  it('times each store on its own', () => {
    const plan = new EdgePurgePlan()
    plan.note('s1', false, 0)
    plan.note('s2', false, 4_000)
    expect(plan.take(PURGE_QUIET_MS)).toEqual(['s1'])
    expect(plan.take(4_000 + PURGE_QUIET_MS)).toEqual(['s2'])
  })
})

describe('purgeCloudflareHosts', () => {
  const ok = () => new Response(JSON.stringify({ success: true }), { status: 200 })

  it('sends hostnames 30 to a call, deduplicated, with the token only in the header', async () => {
    const fetch = vi.fn(async (_url: string, _init: RequestInit) => ok())
    const hosts = Array.from({ length: 31 }, (_, i) => `h${i}.example`)
    await purgeCloudflareHosts(config, [...hosts, 'H0.EXAMPLE'], { fetch })
    expect(fetch).toHaveBeenCalledTimes(2)
    const [url, init] = fetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`https://api.cloudflare.com/client/v4/zones/${config.zoneId}/purge_cache`)
    expect(url).not.toContain('tok')
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer tok')
    expect(JSON.parse(init.body as string).hosts).toHaveLength(30)
    const second = fetch.mock.calls[1] as [string, RequestInit]
    expect(JSON.parse(second[1].body as string)).toEqual({ hosts: ['h30.example'] })
  })

  it('makes no call for no hostnames', async () => {
    const fetch = vi.fn(async () => ok())
    await purgeCloudflareHosts(config, [], { fetch })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('throws on a refused or unsuccessful purge, without echoing the body', async () => {
    const refused = vi.fn(async () => new Response('{"errors":["tok"]}', { status: 403 }))
    await expect(purgeCloudflareHosts(config, ['a.example'], { fetch: refused })).rejects.toThrow(
      'Cloudflare cache purge answered 403',
    )
    const failed = vi.fn(async () => new Response('{"success":false}', { status: 200 }))
    await expect(purgeCloudflareZone(config, { fetch: failed })).rejects.toThrow('did not succeed')
  })
})

describe('cloudflarePurgeConfigFrom', () => {
  it('needs both the purge token and the zone', () => {
    expect(cloudflarePurgeConfigFrom({ CLOUDFLARE_ZONE_ID: config.zoneId })).toBeNull()
    expect(
      cloudflarePurgeConfigFrom({
        CLOUDFLARE_CACHE_PURGE_TOKEN: ' tok ',
        CLOUDFLARE_ZONE_ID: config.zoneId,
      }),
    ).toEqual(config)
  })
})
