import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type BrowserPixel, fbqData, sendPixelEvent } from './track'

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
