/** SOURCE OF TRUTH: inbox insights tests — WHAT: page paths kept from shopper messages, "pages viewed", product handles from paths, location, the AI's view of the thread, whether a reply is due, the question the catalogue search reads, shipping rate lines / WHY: the customer panel and the staff AI help must read a chat the same way, and a page path must never carry a query string or another host. */
import { describe, expect, it } from 'vitest'
import {
  assistThread,
  awaitsReply,
  cleanPagePath,
  latestQuestion,
  locationOf,
  pagesViewed,
  productHandleOf,
  shippingRateLines,
} from './insights'

const msg = (sender: string, body: string, kind = 'text') => ({ sender, kind, body })

describe('cleanPagePath', () => {
  it('keeps a same-site path without query or hash', () => {
    expect(cleanPagePath('/products/kurta?utm=ig#top')).toBe('/products/kurta')
  })
  it('refuses other hosts, schemes and junk', () => {
    expect(cleanPagePath('https://evil.test/x')).toBeNull()
    expect(cleanPagePath('//evil.test/x')).toBeNull()
    expect(cleanPagePath('/a b')).toBeNull()
    expect(cleanPagePath(undefined)).toBeNull()
  })
})

describe('pagesViewed', () => {
  it('newest first, each once, the start page last, at most five', () => {
    const rows = ['/p/3', '/p/2', '/p/3', null, '/p/1'].map((page) => ({
      payload: page ? { page } : null,
    }))
    expect(pagesViewed('/', rows)).toEqual(['/p/3', '/p/2', '/p/1', '/'])
    const many = Array.from({ length: 9 }, (_, i) => ({ payload: { page: `/x/${i}` } }))
    expect(pagesViewed('/', many)).toHaveLength(5)
  })
})

describe('productHandleOf', () => {
  it('reads product pages, with or without a locale prefix', () => {
    expect(productHandleOf('/products/Blue-Kurta')).toBe('blue-kurta')
    expect(productHandleOf('/en-in/products/blue-kurta/')).toBe('blue-kurta')
    expect(productHandleOf('/collections/kurtas')).toBeNull()
    expect(productHandleOf('/products/a/b')).toBeNull()
    expect(productHandleOf(null)).toBeNull()
  })
})

describe('locationOf', () => {
  it('needs a city and a state', () => {
    expect(locationOf({ city: ' Pune ', stateCode: 'MH', pincode: '411001' })).toEqual({
      city: 'Pune',
      stateCode: 'MH',
      pincode: '411001',
    })
    expect(locationOf({ city: 'Pune', stateCode: '' })).toBeNull()
    expect(locationOf(null)).toBeNull()
  })
})

describe('the thread as the AI reads it', () => {
  const thread = [
    msg('shopper', 'Hi'),
    msg('ai', 'Hello, how can I help?'),
    msg('system', '', 'cart_event'),
    msg('staff', 'Gift wrap them', 'note'),
    msg('shopper', 'Is the kurta cotton?'),
    msg('shopper', 'And size M?'),
  ]

  it('keeps text and notes, drops system lines and cards', () => {
    expect(assistThread([...thread, msg('staff', '', 'product')]).map((m) => m.from)).toEqual([
      'shopper',
      'store',
      'note',
      'shopper',
      'shopper',
    ])
  })

  it('a reply is due while the shopper wrote last (notes and cart lines do not count)', () => {
    expect(awaitsReply(thread)).toBe(true)
    expect(awaitsReply([...thread, msg('staff', 'Yes, cotton')])).toBe(false)
    expect(awaitsReply([...thread, msg('staff', 'check stock', 'note')])).toBe(true)
  })

  it('the question is the shopper’s newest unanswered messages', () => {
    expect(latestQuestion(thread)).toBe('Is the kurta cotton? And size M?')
    expect(latestQuestion([...thread, msg('staff', 'Yes')])).toBe('')
  })
})

describe('shipping rates', () => {
  it('reads each zone’s rates with their promise', () => {
    const lines = shippingRateLines([
      {
        name: 'India',
        rates: [
          {
            name: 'Standard',
            pricePaise: 4900,
            freeAbovePaise: 99_900,
            minTransitDays: 3,
            maxTransitDays: 5,
          },
        ],
      },
    ])
    expect(lines).toEqual([
      {
        zone: 'India',
        name: 'Standard',
        pricePaise: 4900,
        freeAbovePaise: 99_900,
        days: '3 to 5 days',
      },
    ])
  })

  it('a one-sided promise reads as one number; none reads as null', () => {
    const rate = (min: number | null, max: number | null) => ({
      name: 'Express',
      pricePaise: 9900,
      freeAbovePaise: null,
      minTransitDays: min,
      maxTransitDays: max,
    })
    const days = shippingRateLines([
      { name: 'Metro', rates: [rate(2, null), rate(1, 1), rate(null, null)] },
    ]).map((l) => l.days)
    expect(days).toEqual(['2 days', '1 day', null])
  })
})
