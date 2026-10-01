import { describe, expect, it } from 'vitest'
import { clientIp } from './ip'

const headers = (h: Record<string, string>) => new Headers(h)

describe('clientIp (security audit D-01)', () => {
  const spoofed = headers({
    'cf-connecting-ip': '198.51.100.1',
    'x-forwarded-for': '198.51.100.2, 10.0.0.1',
    'x-real-ip': '198.51.100.3',
  })

  it('believes no forwarded header by default', () => {
    expect(clientIp(spoofed, { trustedProxy: 'none' })).toBe('unknown')
    expect(clientIp(spoofed, { trustedProxy: 'none', peer: '203.0.113.7' })).toBe('203.0.113.7')
  })

  it('reads cf-connecting-ip only behind Cloudflare', () => {
    expect(clientIp(spoofed, { trustedProxy: 'cloudflare', peer: '172.68.0.1' })).toBe(
      '198.51.100.1',
    )
  })

  it('never falls back to x-forwarded-for or x-real-ip, even behind Cloudflare', () => {
    const noCf = headers({ 'x-forwarded-for': '198.51.100.2', 'x-real-ip': '198.51.100.3' })
    expect(clientIp(noCf, { trustedProxy: 'cloudflare' })).toBe('unknown')
    expect(clientIp(noCf, { trustedProxy: 'cloudflare', peer: '172.68.0.1' })).toBe('172.68.0.1')
  })

  it('ignores junk in the header and unwraps IPv4-mapped peers', () => {
    expect(clientIp(headers({ 'cf-connecting-ip': 'a b; drop' }), { trustedProxy: 'cloudflare' })).toBe(
      'unknown',
    )
    expect(clientIp(headers({}), { trustedProxy: 'none', peer: '::ffff:203.0.113.7' })).toBe(
      '203.0.113.7',
    )
    expect(clientIp(headers({}), { trustedProxy: 'none', peer: '2001:db8::1' })).toBe('2001:db8::1')
  })

  it('reads TRUSTED_PROXY, treating anything unknown as none', () => {
    const cf = headers({ 'cf-connecting-ip': '198.51.100.1' })
    const before = process.env.TRUSTED_PROXY
    try {
      delete process.env.TRUSTED_PROXY
      expect(clientIp(cf)).toBe('unknown')
      process.env.TRUSTED_PROXY = ' Cloudflare '
      expect(clientIp(cf)).toBe('198.51.100.1')
      process.env.TRUSTED_PROXY = 'traefik'
      expect(clientIp(cf)).toBe('unknown')
    } finally {
      if (before === undefined) delete process.env.TRUSTED_PROXY
      else process.env.TRUSTED_PROXY = before
    }
  })
})
