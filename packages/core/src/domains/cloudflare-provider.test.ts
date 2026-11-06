/** SOURCE OF TRUTH: cloudflare provider tests — WHAT: Cloudflare status plus DNS decide a subdomain, held hostnames, API and DNS failures, apex checks, through the real client on a fake fetch and a fake resolver / WHY: tests never touch the network, and a padlock must never connect a domain */
import { describe, expect, it } from 'vitest'
import { createCloudflareClient } from './cloudflare'
import { createCloudflareDomainProvider, DOMAIN_HELD_ERROR } from './cloudflare-provider'
import type { DnsResolver } from './dns-provider'
import type { DomainCheckInput } from './provider'
import { dnsRecordsFor } from './records'

const targets = { aRecord: '15.206.197.145', cnameTarget: 'shops.koomerce.app' }
const TOKEN = 'waimers-verify=abc123'
const now = new Date('2026-11-06T10:00:00Z')
const ZONE = '023e105f4ecef8ad9ca31a8372d0c353'
const ID = '0d89c70d-ad9f-4843-b99f-6cc0252067e9'
const WWW = 'www.brand.in'
const WWW_TXT = `_waimers-verify.${WWW}`
const CF_IP = '104.16.1.1'
const OWNERSHIP = {
  type: 'txt',
  name: `_cf-custom-hostname.${WWW}`,
  value: '5cc07c04-ea62-4a5a-95f0-419334a875a4',
}
const CF_RECORD = {
  type: 'TXT',
  name: '_cf-custom-hostname.www',
  value: OWNERSHIP.value,
  purpose: 'verification',
}

type Zone = {
  a?: Record<string, string[]>
  cname?: Record<string, string[]>
  txt?: Record<string, string[][]>
  fail?: Record<string, string>
}

const dnsError = (code: string, host: string) =>
  Object.assign(new Error(`query ${code} ${host}`), { code })

function fakeResolver(zone: Zone): DnsResolver {
  const answer = <T>(table: Record<string, T[]> | undefined, host: string): Promise<T[]> => {
    const failure = zone.fail?.[host]
    if (failure) return Promise.reject(dnsError(failure, host))
    const found = table?.[host]
    return found ? Promise.resolve(found) : Promise.reject(dnsError('ENOTFOUND', host))
  }
  return {
    resolve4: (h) => answer(zone.a, h),
    resolveCname: (h) => answer(zone.cname, h),
    resolveTxt: (h) => answer(zone.txt, h),
  }
}

/** The merchant did everything we asked: the CNAME, and our TXT. */
const pointed: Zone = {
  a: { [WWW]: [CF_IP] },
  cname: { [WWW]: [targets.cnameTarget] },
  txt: { [WWW_TXT]: [[TOKEN]] },
}

const hostnameAt = (status: string, sslStatus: string, extra: object = {}) => ({
  id: ID,
  hostname: WWW,
  status,
  ownership_verification: OWNERSHIP,
  ssl: { status: sslStatus },
  ...extra,
})

const ok = (result: unknown) =>
  new Response(JSON.stringify({ success: true, errors: [], messages: [], result }), {
    status: 200,
  })

/** In-memory custom hostnames API; `hostname` null means it does not exist yet. */
function fakeApi(start: object | null, opts: { afterRefresh?: object; down?: boolean } = {}) {
  let hostname = start
  const calls: string[] = []
  const fetch = async (url: string, init: RequestInit) => {
    calls.push(`${init.method} ${url.includes(ID) ? 'one' : 'collection'}`)
    if (opts.down) throw new TypeError('fetch failed')
    if (init.method === 'GET') return ok(hostname ? [hostname] : [])
    if (init.method === 'POST') {
      hostname = hostnameAt('pending', 'initializing')
      return ok(hostname)
    }
    if (init.method === 'PATCH') {
      hostname = opts.afterRefresh ?? hostname
      return ok(hostname)
    }
    return ok(null)
  }
  const hostnames = createCloudflareClient({ apiToken: 't', zoneId: ZONE }, { fetch })
  return { calls, hostnames }
}

const input = (over: Partial<DomainCheckInput> = {}): DomainCheckInput => ({
  hostname: WWW,
  verificationToken: TOKEN,
  expected: dnsRecordsFor(WWW, TOKEN, targets),
  targets,
  verifiedAt: null,
  now,
  routeReady: true,
  ...over,
})

function provider(start: object | null, zone: Zone, opts: Parameters<typeof fakeApi>[1] = {}) {
  const api = fakeApi(start, opts)
  const logs: string[] = []
  let handshakes = 0
  const check = createCloudflareDomainProvider({
    hostnames: api.hostnames,
    resolver: fakeResolver(zone),
    tlsCheck: async () => {
      handshakes += 1
      return true
    },
    lookupTimeoutMs: 50,
    log: (m) => logs.push(m),
  })
  return { ...api, logs, check, handshakes: () => handshakes }
}

describe('cloudflare provider: subdomain', () => {
  it('creates the hostname once our TXT is there, and shows the records Cloudflare wants', async () => {
    const p = provider(null, { txt: pointed.txt as Record<string, string[][]> })
    const r = await p.check.check(input())
    expect(p.calls).toEqual(['GET collection', 'POST collection'])
    expect(r).toMatchObject({ dns: 'pending', ssl: 'pending', edgeRecords: [CF_RECORD] })
    expect(r.error).toContain('have not found the CNAME record')
  })

  it('creates nothing, so nothing is billed, for a name the merchant has not proved', async () => {
    const empty = provider(null, {})
    const r = await empty.check.check(input())
    expect(empty.calls).toEqual(['GET collection'])
    expect(r).toMatchObject({ dns: 'pending', ssl: 'pending', edgeRecords: null })
    expect(r.error).toContain('have not found the CNAME record')
    expect(r.error).toContain('have not found the TXT record')

    const cnameOnly = provider(null, { cname: pointed.cname as Record<string, string[]> })
    await cnameOnly.check.check(input())
    expect(cnameOnly.calls).toEqual(['GET collection'])

    const wrongTxt = provider(null, { txt: { [WWW_TXT]: [['waimers-verify=other']] } })
    expect((await wrongTxt.check.check(input())).dns).toBe('misconfigured')
    expect(wrongTxt.calls).toEqual(['GET collection'])
  })

  it('says held straight away when a new hostname comes back blocked', async () => {
    const hostnames = {
      find: async () => null,
      create: async () => ({ ...baseHostname, status: 'blocked' }),
      refresh: async () => ({ ...baseHostname, status: 'blocked' }),
      remove: async () => undefined,
    }
    const r = await createCloudflareDomainProvider({
      hostnames,
      resolver: fakeResolver(pointed),
    }).check(input())
    expect(r.error).toBe(DOMAIN_HELD_ERROR)
  })

  it('does not create a hostname that already exists', async () => {
    const p = provider(hostnameAt('pending', 'initializing'), pointed)
    await p.check.check(input())
    expect(p.calls).not.toContain('POST collection')
  })

  it('finds the hostname when a create loses a race with another check', async () => {
    let posts = 0
    const hostnames = {
      find: async () => (posts > 0 ? { ...baseHostname } : null),
      create: async () => {
        posts += 1
        const { CloudflareError } = await import('./cloudflare')
        throw new CloudflareError('Cloudflare custom_hostnames.create answered 409', 409)
      },
      refresh: async () => baseHostname,
      remove: async () => undefined,
    }
    const r = await createCloudflareDomainProvider({
      hostnames,
      resolver: fakeResolver(pointed),
    }).check(input())
    expect(r.dns).toBe('verified')
  })

  it('connects only when Cloudflare says active and DNS reaches us', async () => {
    const p = provider(hostnameAt('active', 'active'), pointed)
    expect(await p.check.check(input())).toMatchObject({
      dns: 'verified',
      ssl: 'active',
      error: null,
      edgeRecords: [],
    })
  })

  it('counts active_redeploying as active', async () => {
    const p = provider(hostnameAt('active_redeploying', 'active'), pointed)
    expect((await p.check.check(input())).dns).toBe('verified')
  })

  it('never decides from a TLS handshake', async () => {
    const live = provider(hostnameAt('active', 'active'), pointed)
    await live.check.check(input())
    const waiting = provider(hostnameAt('pending', 'pending_validation'), pointed)
    await waiting.check.check(input())
    expect(live.handshakes() + waiting.handshakes()).toBe(0)
  })

  it('stays pending when DNS is right but Cloudflare has not confirmed, and nudges it', async () => {
    const p = provider(hostnameAt('pending', 'pending_validation'), pointed)
    const r = await p.check.check(input())
    expect(r).toMatchObject({ dns: 'pending', ssl: 'pending' })
    expect(r.error).toContain('waiting for Cloudflare')
    expect(p.calls).toContain('PATCH one')
  })

  it('does not nudge Cloudflare while the records are still missing', async () => {
    const p = provider(hostnameAt('pending', 'pending_validation'), {})
    await p.check.check(input())
    expect(p.calls).not.toContain('PATCH one')
  })

  it('reports the certificate from Cloudflare, not from us', async () => {
    const p = provider(hostnameAt('active', 'pending_issuance'), pointed)
    expect(await p.check.check(input())).toMatchObject({ dns: 'verified', ssl: 'issuing' })
  })

  it('holds the certificate at issuing until Traefik has the route the tunnel needs', async () => {
    const p = provider(hostnameAt('active', 'active'), pointed)
    expect(await p.check.check(input({ routeReady: false }))).toMatchObject({
      dns: 'verified',
      ssl: 'issuing',
    })
  })

  it('asks again when a certificate timed out', async () => {
    const p = provider(hostnameAt('active', 'validation_timed_out'), pointed, {
      afterRefresh: hostnameAt('active', 'pending_validation'),
    })
    expect(await p.check.check(input())).toMatchObject({ dns: 'verified', ssl: 'issuing' })
    expect(p.calls).toContain('PATCH one')
  })

  it('says so in plain words when a CAA record blocks the certificate', async () => {
    const p = provider(
      hostnameAt('active', 'pending_validation', {
        ssl: {
          status: 'pending_validation',
          validation_errors: [{ message: 'caa_error: blocked' }],
        },
      }),
      pointed,
    )
    expect((await p.check.check(input())).error).toContain('CAA record on brand.in')
  })

  it('stops showing the TXT once Cloudflare has what it needs', async () => {
    const pending = provider(hostnameAt('pending', 'initializing'), pointed)
    expect((await pending.check.check(input())).edgeRecords).toEqual([CF_RECORD])
    const active = provider(hostnameAt('active', 'active'), pointed)
    expect((await active.check.check(input())).edgeRecords).toEqual([])
  })

  it('shows certificate TXT records when Cloudflare asks for them', async () => {
    const p = provider(
      hostnameAt('active', 'pending_validation', {
        ssl: {
          status: 'pending_validation',
          validation_records: [{ txt_name: `_acme-challenge.${WWW}`, txt_value: 'tok' }],
        },
      }),
      pointed,
    )
    expect((await p.check.check(input())).edgeRecords).toEqual([
      { type: 'TXT', name: '_acme-challenge.www', value: 'tok', purpose: 'verification' },
    ])
  })
})

describe('cloudflare provider: DNS that does not reach us', () => {
  it('refuses a direct A record even when Cloudflare says active (TXT pre-validation)', async () => {
    const p = provider(hostnameAt('active', 'active'), {
      a: { [WWW]: [targets.aRecord] },
      txt: { [WWW_TXT]: [[TOKEN]] },
    })
    const r = await p.check.check(input())
    expect(r).toMatchObject({ dns: 'misconfigured', ssl: 'pending' })
    expect(r.error).toBe(
      `${WWW} points at ${targets.aRecord}. Change it to a CNAME record with the value shops.koomerce.app.`,
    )
  })

  it('refuses a CNAME to the old host even when Cloudflare says active', async () => {
    const p = provider(hostnameAt('active', 'active'), {
      a: { [WWW]: ['23.227.38.65'] },
      cname: { [WWW]: ['shops.myshopify.com'] },
      txt: { [WWW_TXT]: [[TOKEN]] },
    })
    const r = await p.check.check(input())
    expect(r.dns).toBe('misconfigured')
    expect(r.error).toContain('points at shops.myshopify.com')
  })

  it('needs our own TXT, so a CNAME another store left behind proves nothing', async () => {
    const p = provider(hostnameAt('active', 'active'), {
      a: pointed.a as Record<string, string[]>,
      cname: pointed.cname as Record<string, string[]>,
    })
    const r = await p.check.check(input())
    expect(r.dns).toBe('pending')
    expect(r.error).toContain('have not found the TXT record')
  })

  it('reports a TXT with another value as misconfigured', async () => {
    const p = provider(hostnameAt('active', 'active'), {
      ...pointed,
      txt: { [WWW_TXT]: [['waimers-verify=other']] },
    })
    const r = await p.check.check(input())
    expect(r.dns).toBe('misconfigured')
    expect(r.error).toContain('has a different value')
  })

  it('trusts Cloudflare for a name hidden behind the merchant’s own Cloudflare proxy', async () => {
    const zone = { a: { [WWW]: [CF_IP] }, txt: pointed.txt as Record<string, string[][]> }
    const live = provider(hostnameAt('active', 'active'), zone)
    const r = await live.check.check(input())
    expect(r.dns).toBe('verified')
    expect(r.error).toContain('your own Cloudflare account')
    const waiting = provider(hostnameAt('pending', 'initializing'), zone)
    expect((await waiting.check.check(input())).dns).toBe('pending')
  })

  it('accepts the CNAME with a trailing dot and any case', async () => {
    const p = provider(hostnameAt('active', 'active'), {
      ...pointed,
      cname: { [WWW]: ['SHOPS.koomerce.app.'] },
    })
    expect((await p.check.check(input())).dns).toBe('verified')
  })
})

describe('cloudflare provider: held by another host', () => {
  /** Live case: the name CNAMEs to us, the padlock works, another SaaS still holds it. */
  it('never connects a name Shopify still holds, whatever the padlock says', async () => {
    for (const status of ['blocked', 'pending_blocked', 'test_blocked']) {
      const p = provider(hostnameAt(status, 'pending_validation'), pointed)
      const r = await p.check.check(input())
      expect(r).toMatchObject({ dns: 'misconfigured', ssl: 'failed', error: DOMAIN_HELD_ERROR })
      expect(p.handshakes()).toBe(0)
    }
  })

  it('recognises the held-zone error on a hostname that still says pending', async () => {
    const p = provider(
      hostnameAt('pending', 'initializing', {
        verification_errors: [
          'The hostname is associated with a held zone. Please contact the owner of this domain to have the hold removed.',
        ],
      }),
      pointed,
    )
    expect((await p.check.check(input())).error).toBe(DOMAIN_HELD_ERROR)
  })

  it('asks Cloudflare again, so a released name moves on after the merchant presses verify', async () => {
    const p = provider(hostnameAt('blocked', 'initializing'), pointed, {
      afterRefresh: hostnameAt('active', 'active'),
    })
    expect(await p.check.check(input())).toMatchObject({ dns: 'verified', ssl: 'active' })
  })

  it('still says held when asking again fails', async () => {
    const hostnames = {
      find: async () => ({ ...baseHostname, status: 'blocked' }),
      create: async () => baseHostname,
      refresh: async () => {
        throw new Error('Cloudflare custom_hostnames.edit answered 500')
      },
      remove: async () => undefined,
    }
    const logs: string[] = []
    const r = await createCloudflareDomainProvider({
      hostnames,
      resolver: fakeResolver(pointed),
      log: (m) => logs.push(m),
    }).check(input())
    expect(r.error).toBe(DOMAIN_HELD_ERROR)
    expect(logs).toEqual(['[domains] Cloudflare custom_hostnames.edit answered 500'])
  })

  it('tells the merchant to fix DNS for a moved hostname, and revives it once DNS is back', async () => {
    const away = provider(hostnameAt('moved', 'active'), {
      a: { [WWW]: ['1.2.3.4'] },
      txt: pointed.txt as Record<string, string[][]>,
    })
    expect((await away.check.check(input())).dns).toBe('misconfigured')
    expect(away.calls).not.toContain('PATCH one')

    const back = provider(hostnameAt('moved', 'active'), pointed, {
      afterRefresh: hostnameAt('pending', 'active'),
    })
    expect((await back.check.check(input())).dns).toBe('pending')
    expect(back.calls).toContain('PATCH one')
  })
})

describe('cloudflare provider: failures keep the previous state', () => {
  const previous = {
    dns: 'verified' as const,
    ssl: 'issuing' as const,
    edgeRecords: [CF_RECORD as never],
  }

  it('keeps it when the API is down, and logs without the token', async () => {
    const p = provider(null, pointed, { down: true })
    const r = await p.check.check(input({ previous }))
    expect(r).toMatchObject({ dns: 'verified', ssl: 'issuing', edgeRecords: previous.edgeRecords })
    expect(r.error).toContain('could not check')
    expect(p.logs).toEqual(['[domains] Cloudflare custom_hostnames.list could not be reached'])
  })

  it('stays pending, never active, on a first check that fails', async () => {
    const p = provider(null, pointed, { down: true })
    expect(await p.check.check(input())).toMatchObject({
      dns: 'pending',
      ssl: 'pending',
      edgeRecords: null,
    })
  })

  it('keeps it on a rate limit or an auth failure', async () => {
    for (const status of [401, 403, 429, 500]) {
      const hostnames = createCloudflareClient(
        { apiToken: 't', zoneId: ZONE },
        { fetch: async () => new Response('{}', { status }) },
      )
      const r = await createCloudflareDomainProvider({ hostnames }).check(input({ previous }))
      expect(r).toMatchObject({ dns: 'verified', ssl: 'issuing' })
    }
  })

  it('keeps it, with a plain instruction, when Cloudflare refuses the create', async () => {
    const hostnames = createCloudflareClient(
      { apiToken: 't', zoneId: ZONE },
      {
        fetch: async (_url, init) =>
          init.method === 'GET' ? ok([]) : new Response('{}', { status: 400 }),
      },
    )
    const r = await createCloudflareDomainProvider({
      hostnames,
      resolver: fakeResolver(pointed),
    }).check(input({ previous }))
    expect(r).toMatchObject({ dns: 'verified', ssl: 'issuing' })
    expect(r.error).toContain('remove it there')
  })

  it('keeps it when the create itself cannot reach Cloudflare', async () => {
    const hostnames = createCloudflareClient(
      { apiToken: 't', zoneId: ZONE },
      {
        fetch: async (_url, init) => {
          if (init.method === 'GET') return ok([])
          throw new TypeError('fetch failed')
        },
      },
    )
    const r = await createCloudflareDomainProvider({
      hostnames,
      resolver: fakeResolver(pointed),
    }).check(input({ previous }))
    expect(r).toMatchObject({ dns: 'verified', ssl: 'issuing' })
    expect(r.error).toContain('could not check')
  })

  it('keeps it when a DNS lookup fails, with Cloudflare’s records still fresh', async () => {
    const p = provider(hostnameAt('pending', 'initializing'), {
      ...pointed,
      fail: { [WWW]: 'ESERVFAIL' },
    })
    const r = await p.check.check(input({ previous }))
    expect(r).toMatchObject({ dns: 'verified', ssl: 'issuing', edgeRecords: [CF_RECORD] })
    expect(r.error).toContain('could not look up')
  })

  it('keeps it when the nudge fails', async () => {
    const hostnames = {
      find: async () => ({ ...baseHostname, status: 'pending' }),
      create: async () => baseHostname,
      refresh: async () => {
        throw new Error('Cloudflare custom_hostnames.edit timed out after 8000 ms')
      },
      remove: async () => undefined,
    }
    const r = await createCloudflareDomainProvider({
      hostnames,
      resolver: fakeResolver(pointed),
    }).check(input({ previous }))
    expect(r).toMatchObject({ dns: 'verified', ssl: 'issuing' })
  })
})

describe('cloudflare provider: apex', () => {
  const APEX = 'brand.in'
  const apexInput = () =>
    input({ hostname: APEX, expected: dnsRecordsFor(APEX, TOKEN, targets), routeReady: false })
  const apexTxt = { [`_waimers-verify.${APEX}`]: [[TOKEN]] }

  it('never calls Cloudflare and connects on our A record plus the TXT', async () => {
    const p = provider(null, { a: { [APEX]: [targets.aRecord] }, txt: apexTxt })
    const r = await p.check.check(apexInput())
    expect(r).toMatchObject({ dns: 'verified', ssl: 'active', error: null })
    expect(r.edgeRecords).toBeUndefined()
    expect(p.calls).toEqual([])
  })

  it('does not count a proxied apex: only our own address reaches the redirect', async () => {
    const p = provider(null, { a: { [APEX]: [CF_IP] }, txt: apexTxt })
    const r = await p.check.check(apexInput())
    expect(r).toMatchObject({ dns: 'pending', ssl: 'pending' })
    expect(r.error).toContain('Turn the proxy off')
  })

  it('reports an apex pointing elsewhere as the dns provider does', async () => {
    const p = provider(null, { a: { [APEX]: ['23.227.38.65'] }, txt: apexTxt })
    expect((await p.check.check(apexInput())).dns).toBe('misconfigured')
  })
})

const baseHostname = {
  id: ID,
  hostname: WWW,
  status: 'active',
  verificationErrors: [],
  ownership: null,
  ssl: { status: 'active', validationErrors: [], txt: [] },
}
