/** SOURCE OF TRUTH: sender email pure rules tests — WHAT: address parsing, DNS records, From/Reply-To choice / WHY: pins what customers see before and after verification */
import { describe, expect, it } from 'vitest'
import {
  chooseSender,
  domainsOverlap,
  parseSenderAddress,
  registrableDomain,
  senderDnsRecords,
} from './client'

describe('parseSenderAddress', () => {
  it('lower-cases and splits a good address', () => {
    expect(parseSenderAddress('  Support@Waimers.IN ')).toEqual({
      ok: true,
      email: 'support@waimers.in',
      local: 'support',
      domain: 'waimers.in',
    })
  })

  it.each([
    ['', 'empty'],
    ['support', 'invalid'],
    ['a@b@waimers.in', 'invalid'],
    ['support@waimers', 'invalid'],
    ['support@-bad.in', 'invalid'],
    ['sup port@waimers.in', 'invalid'],
    ['support@shop.123', 'invalid'],
    ['shop@gmail.com', 'free_mail'],
    ['shop@rediffmail.com', 'free_mail'],
  ])('refuses %j as %s', (raw, error) => {
    expect(parseSenderAddress(raw)).toEqual({ ok: false, error })
  })

  it('refuses the platform domain, its parents and subdomains', () => {
    const reserved = ['mail.waimers.com']
    expect(parseSenderAddress('a@mail.waimers.com', reserved)).toEqual({
      ok: false,
      error: 'platform_domain',
    })
    expect(parseSenderAddress('a@waimers.com', reserved)).toMatchObject({
      error: 'platform_domain',
    })
    expect(parseSenderAddress('a@x.mail.waimers.com', reserved)).toMatchObject({
      error: 'platform_domain',
    })
    expect(parseSenderAddress('a@notwaimers.com', reserved)).toMatchObject({ ok: true })
  })
})

describe('domainsOverlap', () => {
  it('is true for equal, parent and child domains only', () => {
    expect(domainsOverlap('waimers.in', 'waimers.in')).toBe(true)
    expect(domainsOverlap('shop.waimers.in', 'waimers.in')).toBe(true)
    expect(domainsOverlap('waimers.in', 'shop.waimers.in')).toBe(true)
    expect(domainsOverlap('mywaimers.in', 'waimers.in')).toBe(false)
  })
})

describe('senderDnsRecords', () => {
  it('lists three DKIM CNAMEs, the bounce MX and SPF, and a DMARC suggestion', () => {
    const records = senderDnsRecords({
      domain: 'waimers.in',
      dkimTokens: ['t1', 't2', 't3'],
      dkimHostedZone: 'dkim.amazonses.com',
      mailFromDomain: 'bounce.waimers.in',
      region: 'ap-south-1',
    })
    expect(records).toEqual([
      {
        type: 'CNAME',
        name: 't1._domainkey.waimers.in',
        host: 't1._domainkey',
        value: 't1.dkim.amazonses.com',
        purpose: 'dkim',
      },
      expect.objectContaining({ name: 't2._domainkey.waimers.in', value: 't2.dkim.amazonses.com' }),
      expect.objectContaining({ name: 't3._domainkey.waimers.in' }),
      {
        type: 'MX',
        name: 'bounce.waimers.in',
        host: 'bounce',
        value: 'feedback-smtp.ap-south-1.amazonses.com',
        priority: 10,
        purpose: 'mailFrom',
      },
      {
        type: 'TXT',
        name: 'bounce.waimers.in',
        host: 'bounce',
        value: 'v=spf1 include:amazonses.com ~all',
        purpose: 'mailFrom',
      },
      {
        type: 'TXT',
        name: '_dmarc.waimers.in',
        host: '_dmarc',
        value: 'v=DMARC1; p=none;',
        purpose: 'dmarc',
      },
    ])
  })

  it('writes hosts relative to the zone for a subdomain sender on a .co.in domain', () => {
    expect(registrableDomain('shop.waimers.co.in')).toBe('waimers.co.in')
    const records = senderDnsRecords({
      domain: 'shop.waimers.co.in',
      dkimTokens: ['t1', 't2', 't3'],
      dkimHostedZone: null,
      mailFromDomain: null,
      region: 'ap-south-1',
    })
    // No MAIL FROM rows when SES refused the bounce subdomain.
    expect(records).toHaveLength(4)
    expect(records[0]).toMatchObject({
      host: 't1._domainkey.shop',
      value: 't1.dkim.amazonses.com',
    })
    expect(records[3]).toMatchObject({ name: '_dmarc.waimers.co.in', host: '_dmarc' })
  })
})

describe('chooseSender', () => {
  const platform = { fromEmail: 'no-reply@mail.waimers.com', fromName: 'Waimers' }
  const sender = {
    email: 'support@waimers.in',
    domain: 'waimers.in',
    displayName: null,
    status: 'pending' as const,
  }

  it('sends from the platform with Reply-To the shop until the domain is verified', () => {
    expect(chooseSender({ storeName: 'Waimers Gear', sender, platform })).toEqual({
      fromName: 'Waimers Gear',
      fromEmail: 'no-reply@mail.waimers.com',
      replyTo: 'support@waimers.in',
      using: 'platform',
    })
  })

  it('sends from the shop’s own address once verified, with its display name', () => {
    expect(
      chooseSender({
        storeName: 'Waimers Gear',
        sender: { ...sender, status: 'verified', displayName: 'Waimers Support' },
        platform,
      }),
    ).toEqual({
      fromName: 'Waimers Support',
      fromEmail: 'support@waimers.in',
      replyTo: undefined,
      using: 'own',
    })
  })

  it('never puts an address off the verified domain in From', () => {
    const r = chooseSender({
      storeName: 'S',
      sender: { ...sender, status: 'verified', email: 'ceo@other-shop.in' },
      platform,
    })
    expect(r.using).toBe('platform')
    expect(r.fromEmail).toBe(platform.fromEmail)
  })

  it('falls back to the contact email for replies when no sender is set', () => {
    expect(
      chooseSender({ storeName: '', sender: null, platform, contactEmail: 'owner@gmail.com' }),
    ).toEqual({
      fromName: 'Waimers',
      fromEmail: platform.fromEmail,
      replyTo: 'owner@gmail.com',
      using: 'platform',
    })
  })
})
