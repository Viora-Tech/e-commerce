import { describe, expect, it } from 'vitest'
import { apexOf, isApex, isPlatformHostname, normaliseHostname, wwwCounterpart } from './hostname'
import { dnsRecordsFor, relativeName } from './records'

describe('normaliseHostname', () => {
  it('reduces what a merchant pastes to a bare lower-case hostname', () => {
    expect(normaliseHostname('  https://WWW.Brand.in/collections/all?x=1 ')).toEqual({
      ok: true,
      hostname: 'www.brand.in',
    })
    expect(normaliseHostname('brand.co.in.')).toEqual({ ok: true, hostname: 'brand.co.in' })
    expect(normaliseHostname('shop.brand.com:8443')).toEqual({
      ok: true,
      hostname: 'shop.brand.com',
    })
  })

  it('converts an internationalised name to punycode', () => {
    const r = normaliseHostname('bücher.de')
    expect(r).toEqual({ ok: true, hostname: 'xn--bcher-kva.de' })
  })

  it('refuses empty input, bare words, IP addresses and bad characters', () => {
    expect(normaliseHostname('').ok).toBe(false)
    expect(normaliseHostname('brand').ok).toBe(false)
    expect(normaliseHostname('192.168.1.10').ok).toBe(false)
    expect(normaliseHostname('bra_nd.in').ok).toBe(false)
    expect(normaliseHostname('-brand.in').ok).toBe(false)
    expect(normaliseHostname('brand.123').ok).toBe(false)
  })
})

describe('apex and www twins', () => {
  it('knows Indian second-level suffixes', () => {
    expect(apexOf('www.brand.co.in')).toBe('brand.co.in')
    expect(isApex('brand.co.in')).toBe(true)
    expect(isApex('brand.in')).toBe(true)
    expect(isApex('shop.brand.in')).toBe(false)
  })

  it('pairs an apex with www and back, but not other subdomains', () => {
    expect(wwwCounterpart('brand.in')).toBe('www.brand.in')
    expect(wwwCounterpart('www.brand.co.in')).toBe('brand.co.in')
    expect(wwwCounterpart('shop.brand.in')).toBeNull()
  })

  it('spots platform domains and their subdomains', () => {
    expect(isPlatformHostname('localhost', ['localhost'])).toBe(true)
    expect(isPlatformHostname('waimers.localhost', ['localhost'])).toBe(true)
    expect(isPlatformHostname('mylocalhost.in', ['localhost'])).toBe(false)
  })
})

describe('dnsRecordsFor', () => {
  const targets = { aRecord: '192.0.2.10', cnameTarget: 'shops.waimers.localhost' }

  it('asks for an A record at the apex, with the TXT beside it', () => {
    expect(dnsRecordsFor('brand.in', 'tok', targets)).toEqual([
      { type: 'A', name: '@', value: '192.0.2.10', purpose: 'routing' },
      { type: 'TXT', name: '_waimers-verify', value: 'tok', purpose: 'verification' },
    ])
  })

  it('asks for a CNAME on a subdomain, named relative to the zone', () => {
    expect(relativeName('shop.eu.brand.co.in')).toBe('shop.eu')
    expect(dnsRecordsFor('www.brand.co.in', 'tok', targets)).toEqual([
      { type: 'CNAME', name: 'www', value: 'shops.waimers.localhost', purpose: 'routing' },
      { type: 'TXT', name: '_waimers-verify.www', value: 'tok', purpose: 'verification' },
    ])
  })

  it('omits the TXT when there is no token', () => {
    expect(dnsRecordsFor('brand.in', null, targets)).toHaveLength(1)
  })
})
