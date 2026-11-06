import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type BrowserPixel, fbqData, matchData, sendPixelEvent } from './track'

const fbq = vi.fn()
const beacons: string[] = []

beforeEach(() => {
  fbq.mockReset()
  beacons.length = 0
  vi.stubGlobal('window', { fbq, location: { href: 'https://w.in/p/x', pathname: '/p/x' } })
  vi.stubGlobal('navigator', {
    sendBeacon: (_url: string, body: Blob) => {
      void body.text().then((t) => beacons.push(t))
      return true
    },
  })
})
afterEach(() => {
  vi.unstubAllGlobals()
})

const placed: BrowserPixel = {
  id: '1111111111',
  events: ['PageView', 'Purchase'],
  browserPurchase: true,
}
const delivered: BrowserPixel = {
  id: '2222222222',
  events: ['PageView', 'Purchase'],
  browserPurchase: false,
}
const pageOnly: BrowserPixel = { id: '3333333333', events: ['PageView'], browserPurchase: true }

describe('pixel events in the browser', () => {
  it('maps values to rupees and content ids', () => {
    expect(
      fbqData({ name: 'Purchase', valuePaise: 149_900, contentIds: ['v1'], numItems: 2 }),
    ).toEqual({
      value: 1499,
      currency: 'INR',
      content_ids: ['v1'],
      content_type: 'product',
      num_items: 2,
    })
    expect(fbqData({ name: 'PageView' })).toEqual({})
  })

  it('sends Purchase only to "placed" pixels with it on, with one shared event id', async () => {
    sendPixelEvent([placed, delivered, pageOnly], { name: 'Purchase', eventId: 'ord_abc' })
    expect(fbq).toHaveBeenCalledTimes(1)
    expect(fbq).toHaveBeenCalledWith(
      'trackSingle',
      '1111111111',
      'Purchase',
      {},
      { eventID: 'ord_abc' },
    )
    await new Promise((r) => setTimeout(r, 0))
    expect(JSON.parse(beacons[0] as string)).toMatchObject({ name: 'Purchase', eventId: 'ord_abc' })
  })

  it('tells the collector how many were added, for AddToCart only', async () => {
    const add: BrowserPixel = { id: '4444444444', events: ['AddToCart'], browserPurchase: true }
    sendPixelEvent([add], {
      name: 'AddToCart',
      eventId: 'atc_v1_1',
      variantId: 'v1',
      valuePaise: 99_800,
      numItems: 2,
    })
    sendPixelEvent([add], { name: 'PageView', eventId: '0199a000-0000-7000-8000-000000000001' })
    await new Promise((r) => setTimeout(r, 0))
    const sent = beacons.map((b) => JSON.parse(b) as Record<string, unknown>)
    expect(sent.find((b) => b.name === 'AddToCart')).toMatchObject({ quantity: 2 })
    expect(sent.find((b) => b.name === 'PageView')).not.toHaveProperty('quantity')
    expect(fbq).toHaveBeenCalledWith(
      'trackSingle',
      '4444444444',
      'AddToCart',
      { value: 998, currency: 'INR', content_ids: ['v1'], content_type: 'product', num_items: 2 },
      { eventID: 'atc_v1_1' },
    )
  })

  it('adds advanced matching for the pixel, never for our own collector', async () => {
    const pay: BrowserPixel = {
      id: '5555555555',
      events: ['AddPaymentInfo'],
      browserPurchase: true,
    }
    sendPixelEvent([pay], {
      name: 'AddPaymentInfo',
      eventId: 'api_c1_upi',
      match: { email: ' A@B.in ', phone: '98765 43210' },
    })
    expect(fbq).toHaveBeenNthCalledWith(1, 'init', '5555555555', {
      em: 'a@b.in',
      ph: '919876543210',
    })
    expect(fbq.mock.calls[1]?.[0]).toBe('trackSingle')
    await new Promise((r) => setTimeout(r, 0))
    expect(beacons[0]).not.toContain('a@b.in')
    expect(beacons[0]).not.toContain('9876543210')
  })

  it('skips matching when nothing usable was typed', () => {
    expect(matchData({ email: 'nope', phone: '123' })).toBeNull()
    expect(matchData(undefined)).toBeNull()
  })

  it('sends nothing from sign-in pages', () => {
    vi.stubGlobal('window', {
      fbq,
      location: {
        href: 'https://w.in/account/login/link?token=x',
        pathname: '/account/login/link',
      },
    })
    sendPixelEvent([placed], { name: 'PageView', eventId: '0199a000-0000-7000-8000-000000000001' })
    expect(fbq).not.toHaveBeenCalled()
  })
})
