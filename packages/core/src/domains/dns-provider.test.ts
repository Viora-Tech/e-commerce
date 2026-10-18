/** SOURCE OF TRUTH: dns domain provider tests — WHAT: apex, CNAME, flattened, Cloudflare proxy, TXT, TLS and timeout cases with a fake resolver / WHY: tests never call real DNS */
import { describe, expect, it } from 'vitest'
import { createDnsDomainProvider, type DnsResolver } from './dns-provider'
import type { DomainCheckInput } from './provider'
import { dnsRecordsFor } from './records'

const targets = { aRecord: '15.206.197.145', cnameTarget: 'shops.koomerce.app' }
const TOKEN = 'waimers-verify=abc123'
const now = new Date('2026-10-05T10:00:00Z')

type Zone = {
  a?: Record<string, string[]>
  cname?: Record<string, string[]>
  txt?: Record<string, string[][]>
  /** Hostnames whose lookups fail with this error code. */
  fail?: Record<string, string>
}

const dnsError = (code: string, host: string) =>
  Object.assign(new Error(`query ${code} ${host}`), { code })

/** In-memory resolver: missing names answer ENOTFOUND, like a real NXDOMAIN. */
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

function input(hostname: string, extra: Partial<DomainCheckInput> = {}): DomainCheckInput {
  return {
    hostname,
    verificationToken: TOKEN,
    expected: dnsRecordsFor(hostname, TOKEN, targets),
    targets,
    verifiedAt: null,
    now,
    ...extra,
  }
}

function provider(zone: Zone, tlsOk = true) {
  const tlsCalls: string[] = []
  const p = createDnsDomainProvider({
    resolver: fakeResolver(zone),
    tlsCheck: async (h) => {
      tlsCalls.push(h)
      return tlsOk
    },
    lookupTimeoutMs: 50,
  })
  return { p, tlsCalls }
}

const apexTxt = { '_waimers-verify.kuldeepsaini.com': [[TOKEN]] }

describe('dns domain provider', () => {
  it('verifies an apex whose A record points at the server, then finds the certificate', async () => {
    const { p, tlsCalls } = provider({
      a: { 'kuldeepsaini.com': [targets.aRecord] },
      txt: apexTxt,
    })
    const r = await p.check(input('kuldeepsaini.com'))
    expect(r).toEqual({
      dns: 'verified',
      ssl: 'active',
      observed: [
        { type: 'A', name: '@', value: targets.aRecord },
        { type: 'TXT', name: '_waimers-verify', value: TOKEN },
      ],
      error: null,
    })
    expect(tlsCalls).toEqual(['kuldeepsaini.com'])
  })

  it('calls an apex pointing elsewhere misconfigured, in plain words', async () => {
    const { p, tlsCalls } = provider({
      a: { 'kuldeepsaini.com': ['1.2.3.4'] },
      txt: apexTxt,
    })
    const r = await p.check(input('kuldeepsaini.com'))
    expect(r.dns).toBe('misconfigured')
    expect(r.ssl).toBe('pending')
    expect(r.error).toBe(
      `kuldeepsaini.com points at 1.2.3.4. Change the A record to ${targets.aRecord}.`,
    )
    expect(r.observed).toContainEqual({ type: 'A', name: '@', value: '1.2.3.4' })
    expect(tlsCalls).toEqual([])
  })

  it('keeps a domain with no records at all pending', async () => {
    const { p } = provider({})
    const r = await p.check(input('kuldeepsaini.com'))
    expect(r).toMatchObject({ dns: 'pending', ssl: 'pending', observed: [] })
  })

  it('verifies a subdomain whose CNAME points at the target, ignoring case and the trailing dot', async () => {
    const { p } = provider({
      cname: { 'www.brand.in': ['Shops.Koomerce.App.'] },
      a: { 'www.brand.in': ['52.1.1.1'] },
      txt: { '_waimers-verify.www.brand.in': [[TOKEN]] },
    })
    const r = await p.check(input('www.brand.in'))
    expect(r).toMatchObject({ dns: 'verified', ssl: 'active', error: null })
    expect(r.observed[0]).toEqual({ type: 'CNAME', name: 'www', value: 'shops.koomerce.app' })
  })

  it('accepts a flattened subdomain whose A record is the server address', async () => {
    const { p } = provider({
      a: { 'shop.brand.in': [targets.aRecord] },
      txt: { '_waimers-verify.shop.brand.in': [[TOKEN]] },
    })
    const r = await p.check(input('shop.brand.in'))
    expect(r).toMatchObject({ dns: 'verified', ssl: 'active' })
  })

  it('calls a subdomain CNAME to another host misconfigured', async () => {
    const { p } = provider({
      cname: { 'www.brand.in': ['shops.myshopify.com'] },
      a: { 'www.brand.in': ['23.227.38.65'] },
      txt: { '_waimers-verify.www.brand.in': [[TOKEN]] },
    })
    const r = await p.check(input('www.brand.in'))
    expect(r.dns).toBe('misconfigured')
    expect(r.error).toBe(
      `www.brand.in points at shops.myshopify.com. Change it to a CNAME record with the value ${targets.cnameTarget}.`,
    )
  })

  it('waits for a missing TXT record even when routing is right', async () => {
    const { p, tlsCalls } = provider({ a: { 'kuldeepsaini.com': [targets.aRecord] } })
    const r = await p.check(input('kuldeepsaini.com'))
    expect(r).toMatchObject({ dns: 'pending', ssl: 'pending' })
    expect(r.error).toMatch(/TXT record _waimers-verify/)
    expect(tlsCalls).toEqual([])
  })

  it('calls a TXT record with another token misconfigured', async () => {
    const { p } = provider({
      a: { 'kuldeepsaini.com': [targets.aRecord] },
      txt: { '_waimers-verify.kuldeepsaini.com': [['waimers-verify=old']] },
    })
    const r = await p.check(input('kuldeepsaini.com'))
    expect(r.dns).toBe('misconfigured')
    expect(r.error).toBe(
      `The TXT record _waimers-verify has a different value. Change it to ${TOKEN}.`,
    )
  })

  it('needs no TXT record when no token is expected', async () => {
    const { p } = provider({ a: { 'kuldeepsaini.com': [targets.aRecord] } })
    const r = await p.check(
      input('kuldeepsaini.com', {
        verificationToken: null,
        expected: dnsRecordsFor('kuldeepsaini.com', null, targets),
      }),
    )
    expect(r).toMatchObject({ dns: 'verified', ssl: 'active' })
  })

  it('reports issuing while the certificate is not served yet', async () => {
    const { p } = provider({ a: { 'kuldeepsaini.com': [targets.aRecord] }, txt: apexTxt }, false)
    const r = await p.check(input('kuldeepsaini.com'))
    expect(r).toMatchObject({ dns: 'verified', ssl: 'issuing' })
  })

  it('treats a failing TLS check as issuing, never a throw', async () => {
    const p = createDnsDomainProvider({
      resolver: fakeResolver({ a: { 'kuldeepsaini.com': [targets.aRecord] }, txt: apexTxt }),
      tlsCheck: async () => {
        throw new Error('ECONNRESET')
      },
    })
    expect(await p.check(input('kuldeepsaini.com'))).toMatchObject({
      dns: 'verified',
      ssl: 'issuing',
    })
  })

  describe('behind the Cloudflare proxy', () => {
    const proxied = { 'kuldeepsaini.com': ['104.21.46.43', '172.67.223.157'] }

    it('verifies through the TXT record and says so', async () => {
      const { p } = provider({ a: proxied, txt: apexTxt })
      const r = await p.check(input('kuldeepsaini.com'))
      expect(r).toMatchObject({ dns: 'verified', ssl: 'active' })
      expect(r.error).toMatch(/Cloudflare's proxy/)
    })

    it('waits for the TXT record instead of calling the domain misconfigured', async () => {
      const { p } = provider({ a: proxied })
      const r = await p.check(input('kuldeepsaini.com'))
      expect(r).toMatchObject({ dns: 'pending', ssl: 'pending' })
      expect(r.error).toMatch(/Cloudflare's proxy.*TXT record _waimers-verify/)
    })
  })

  describe('when DNS cannot answer', () => {
    it('keeps the previous state on a timeout code, without throwing', async () => {
      const { p, tlsCalls } = provider({ fail: { 'kuldeepsaini.com': 'ETIMEOUT' } })
      const r = await p.check(
        input('kuldeepsaini.com', { previous: { dns: 'verified', ssl: 'issuing' } }),
      )
      expect(r).toMatchObject({ dns: 'verified', ssl: 'issuing', observed: [] })
      expect(r.error).toMatch(/could not look up kuldeepsaini\.com/)
      expect(tlsCalls).toEqual([])
    })

    it('keeps the previous state when a lookup hangs past the time limit', async () => {
      const hanging: DnsResolver = {
        resolve4: () => new Promise(() => {}),
        resolveCname: () => new Promise(() => {}),
        resolveTxt: () => new Promise(() => {}),
      }
      const p = createDnsDomainProvider({
        resolver: hanging,
        tlsCheck: async () => true,
        lookupTimeoutMs: 20,
      })
      const r = await p.check(
        input('kuldeepsaini.com', { previous: { dns: 'misconfigured', ssl: 'pending' } }),
      )
      expect(r).toMatchObject({ dns: 'misconfigured', ssl: 'pending' })
    })

    it('treats ENODATA as no record, not as a failure', async () => {
      const { p } = provider({
        a: { 'kuldeepsaini.com': [targets.aRecord] },
        fail: { '_waimers-verify.kuldeepsaini.com': 'ENODATA' },
      })
      const r = await p.check(input('kuldeepsaini.com'))
      expect(r).toMatchObject({ dns: 'pending', ssl: 'pending' })
      expect(r.error).toMatch(/TXT record/)
    })
  })
})
