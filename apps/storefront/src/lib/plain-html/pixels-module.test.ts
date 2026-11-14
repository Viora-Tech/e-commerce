import { describe, expect, it } from 'vitest'
import { fbqData } from '../pixels/track'
import { islandScript } from './islands'
import { ISLAND_MODULES, islandModuleOf, islandModuleUrl } from './modules'
import { PIXELS_MODULE } from './pixels-module'

type Call = unknown[]

/** Runs the pixels module against a stand-in browser and returns what it sent. */
function run(
  pixels: unknown[],
  queued: Record<string, unknown>[] = [],
  path = '/',
  fetchImpl?: (url: string) => Promise<unknown>,
) {
  const fbq: Call[] = []
  const sent: { path: string; body: Record<string, unknown> }[] = []
  const inlined: string[] = []
  const listeners: Record<string, (e: { detail: unknown }) => void> = {}
  const store = new Map<string, string>()
  const win = {
    fbq: (...args: unknown[]) => fbq.push(args),
    __commerceTrack: queued,
    addEventListener: (name: string, fn: (e: { detail: unknown }) => void) => {
      listeners[name] = fn
    },
    __commerceIsland: (_name: string, fn: (c: unknown, api: unknown) => void) =>
      fn(
        { pixels, init: 'INIT', private: ['/account/login', '/cod'] },
        {
          inline: (code: string) => inlined.push(code),
          send: (p: string, body: Record<string, unknown>) => sent.push({ path: p, body }),
        },
      ),
  }
  new Function('window', 'location', 'sessionStorage', 'crypto', 'fetch', PIXELS_MODULE)(
    win,
    { pathname: path, href: `https://shop.test${path}` },
    {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
    },
    { randomUUID: () => '00000000-0000-4000-8000-000000000000' },
    fetchImpl,
  )
  return {
    fbq,
    sent,
    inlined,
    fire: (detail: unknown) => listeners['commerce:track']?.({ detail }),
  }
}

const pixel = (events: string[], browserPurchase = false) => ({
  id: '1440778408027080',
  events,
  browserPurchase,
})

describe('pixels island module', () => {
  it('starts fbevents.js and sends a PageView to the pixel and /api/px', () => {
    const r = run([pixel(['PageView'])])
    expect(r.inlined).toEqual(['INIT'])
    expect(r.fbq).toEqual([
      ['init', '1440778408027080'],
      [
        'trackSingle',
        '1440778408027080',
        'PageView',
        {},
        { eventID: '00000000-0000-4000-8000-000000000000' },
      ],
    ])
    expect(r.sent[0]?.path).toBe('/api/px')
    expect(r.sent[0]?.body).toMatchObject({ name: 'PageView', url: 'https://shop.test/' })
  })

  it('builds the same custom data as the React listener', () => {
    const r = run([pixel(['AddToCart', 'Purchase'], true)])
    const detail = {
      name: 'AddToCart' as const,
      variantId: 'v1',
      valuePaise: 129_900,
      numItems: 2,
    }
    r.fire({ ...detail })
    expect(r.fbq[0]).toEqual(['init', '1440778408027080'])
    expect(r.fbq[1]).toEqual([
      'trackSingle',
      '1440778408027080',
      'AddToCart',
      fbqData(detail),
      { eventID: 'atc_v1_1' },
    ])
    expect(r.sent.at(-1)?.body).toMatchObject({ name: 'AddToCart', quantity: 2, variantId: 'v1' })
    r.fire({ ...detail })
    expect(r.fbq.at(-1)?.[4]).toEqual({ eventID: 'atc_v1_2' })
  })

  it('initialises with the hashed matching from /api/px/me before the first event', async () => {
    const em = 'a'.repeat(64)
    const asked: string[] = []
    const r = run([pixel(['PageView'])], [], '/', (url) => {
      asked.push(url)
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ match: { em, ph: '919876543210', zz: em } }),
      })
    })
    expect(r.fbq).toHaveLength(0)
    await new Promise((res) => setTimeout(res, 0))
    expect(asked).toEqual(['/api/px/me'])
    // Plain values and unknown keys never reach fbevents.js.
    expect(r.fbq[0]).toEqual(['init', '1440778408027080', { em }])
    expect(r.fbq[1]?.[0]).toBe('trackSingle')
  })

  it('starts without matching when /api/px/me has nothing', async () => {
    const r = run([pixel(['PageView'])], [], '/', () =>
      Promise.resolve({ ok: true, status: 204, json: () => Promise.resolve(null) }),
    )
    await new Promise((res) => setTimeout(res, 0))
    expect(r.fbq[0]).toEqual(['init', '1440778408027080'])
  })

  it('skips events a pixel has off, browser Purchase unless allowed, and queued handled ones', () => {
    const r = run(
      [pixel(['ViewContent'])],
      [{ name: 'ViewContent', handled: true }, { name: 'ViewContent' }],
    )
    expect(r.fbq.filter((c) => c[0] === 'trackSingle').map((c) => c[2])).toEqual(['ViewContent'])
    r.fire({ name: 'Purchase', eventId: 'ord_1' })
    expect(r.fbq.filter((c) => c[0] === 'trackSingle')).toHaveLength(1)
    expect(r.sent.at(-1)?.body).toMatchObject({ name: 'Purchase', eventId: 'ord_1' })
  })

  it('sends nothing from a private page', () => {
    const r = run([pixel(['PageView'])], [], '/account/login/link')
    expect(r.fbq.filter((c) => c[0] === 'trackSingle')).toHaveLength(0)
    expect(r.sent).toHaveLength(0)
  })
})

describe('island modules', () => {
  it('are served by name with a content version', () => {
    expect(islandModuleOf('pixels.js')).toBe('pixels')
    expect(islandModuleOf('constructor.js')).toBeNull()
    expect(islandModuleUrl('pixels')).toMatch(/^\/api\/islands\/pixels\.js\?v=[\w-]{10}$/)
    for (const code of Object.values(ISLAND_MODULES)) expect(() => new Function(code)).not.toThrow()
  })

  it('the inline island loads the pixels module only with the app, and drops the legacy pixel', () => {
    const base = {
      bannerVersion: 2,
      tracking: { ga4: '', gtm: '', metaPixel: '1234567890', googleAds: '' },
      umami: null,
    }
    const without = islandScript(base)
    expect(without).toContain("fbq('init','1234567890')")
    expect(without).not.toContain('/api/islands/pixels.js')
    const withApp = islandScript({
      ...base,
      pixels: [pixel(['PageView'])] as never,
      experiments: ['exp-1'],
    })
    expect(withApp).not.toContain("fbq('init','1234567890')")
    expect(withApp).toContain('/api/islands/pixels.js?v=')
    expect(withApp).toContain('"experiments":["exp-1"]')
    expect(() => new Function(withApp)).not.toThrow()
  })
})
