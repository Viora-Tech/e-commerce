import { describe, expect, it } from 'vitest'
import {
  digest,
  keepable,
  type LiquidRenderScope,
  layoutCacheKey,
  NONCE_MARK,
  newTrace,
  renderTtl,
  sectionCacheKey,
  servable,
  traceCartReads,
  withNonce,
} from './liquid-cache'

const scope: LiquidRenderScope = {
  themeId: 't1',
  themeVersion: '2026-10-11T10:00:00.000Z',
  origin: 'https://waimers.in',
  path: '/',
  template: 'index',
  postedForm: null,
}

const section = { id: 'hero', type: 'hero', settings: { title: 'Hi' }, blocks: [], index: 0 }

describe('liquid cache keys', () => {
  it('the same render inputs give the same key', () => {
    expect(sectionCacheKey(scope, section)).toBe(sectionCacheKey({ ...scope }, { ...section }))
    expect(layoutCacheKey(scope)).toBe(layoutCacheKey({ ...scope }))
  })

  it('anything a render reads changes the key', () => {
    const base = sectionCacheKey(scope, section)
    const variants: Partial<LiquidRenderScope>[] = [
      { themeId: 't2' },
      { themeVersion: '2026-10-11T11:00:00.000Z' },
      { origin: 'https://other.in' },
      { origin: 'http://waimers.in' },
      { path: '/products/mouse' },
      { template: 'product' },
      { postedForm: 'contact' },
    ]
    for (const patch of variants) {
      expect(sectionCacheKey({ ...scope, ...patch }, section), JSON.stringify(patch)).not.toBe(base)
      expect(layoutCacheKey({ ...scope, ...patch })).not.toBe(layoutCacheKey(scope))
    }
    expect(sectionCacheKey(scope, { ...section, settings: { title: 'Bye' } })).not.toBe(base)
    expect(sectionCacheKey(scope, { ...section, index: 1 })).not.toBe(base)
  })

  it('a section key never equals a layout key', () => {
    expect(sectionCacheKey(scope, {})).not.toBe(layoutCacheKey(scope))
  })

  it('digest is stable and short', () => {
    expect(digest([1, 'a'])).toBe(digest([1, 'a']))
    expect(digest([1, 'a'])).not.toBe(digest([1, 'b']))
    expect(digest({ big: 'x'.repeat(10_000) }).length).toBeLessThan(40)
  })
})

describe('nonce placeholder', () => {
  it('is replaced by each request’s own nonce', () => {
    const html = `<script nonce="${NONCE_MARK}">a()</script><script nonce="${NONCE_MARK}" src="/b.js"></script>`
    expect(withNonce(html, 'abc+/=')).toBe(
      '<script nonce="abc+/=">a()</script><script nonce="abc+/=" src="/b.js"></script>',
    )
    expect(withNonce(html, 'second')).not.toContain(NONCE_MARK)
  })

  it('is random per process and leaves other markup alone', () => {
    expect(NONCE_MARK).toMatch(/^nonce[0-9a-f]{32}$/)
    expect(withNonce('<script nonce="guess">x()</script>', 'real')).toBe(
      '<script nonce="guess">x()</script>',
    )
  })
})

describe('cart and clock tracing', () => {
  it('notes any read of the cart, by whichever render is current', () => {
    let current = newTrace()
    const cart = traceCartReads({ item_count: 0, items: [] }, () => current)
    const first = current
    expect(first.cart).toBe(false)
    void cart.item_count
    expect(first.cart).toBe(true)
    current = newTrace()
    expect('items' in cart).toBe(true)
    expect(current.cart).toBe(true)
    current = newTrace()
    Object.keys(cart)
    expect(current.cart).toBe(true)
  })

  it('serves a cart-reading render only to an empty cart, and never asks otherwise', async () => {
    let asked = 0
    const empty = async () => {
      asked++
      return true
    }
    const full = async () => false
    expect(await servable({ cart: false }, empty)).toBe(true)
    expect(asked).toBe(0)
    expect(await servable({ cart: true }, empty)).toBe(true)
    expect(await servable({ cart: true }, full)).toBe(false)
  })

  it('never keeps a render made with a shopper’s own cart', () => {
    expect(keepable({ cart: true, clock: false, failed: false }, false)).toBe(false)
    expect(keepable({ cart: true, clock: false, failed: false }, true)).toBe(true)
    expect(keepable({ cart: false, clock: false, failed: false }, false)).toBe(true)
  })

  it('keeps clock-reading and failed renders briefly', () => {
    const hour = 3_600_000
    expect(renderTtl({ cart: false, clock: false, failed: false }, hour)).toBe(hour)
    expect(renderTtl({ cart: false, clock: true, failed: false }, hour)).toBe(60_000)
    expect(renderTtl({ cart: false, clock: false, failed: true }, hour)).toBe(30_000)
  })
})
