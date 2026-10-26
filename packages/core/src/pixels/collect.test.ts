/** SOURCE OF TRUTH: Pixels collector tests — WHAT: the browser body is accepted only in our five events and id shapes, _fbp/_fbc are kept, minted or replaced by a new ad click, the cart gets the shopper's tracking, server copies are planned only for pixels with a token and the event on (never Purchase), and the browser gets unpaused pixels with the "placed"-only Purchase rule / WHY: the collector is the consent and dedup boundary between the browser and Meta */
import { cart, createDb, pixelConnection, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  browserPixels,
  collectorStore,
  collectPixelEvent,
  firstPartyIds,
  parsePixelBeacon,
} from './collect'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const uuid = '0199a000-0000-7000-8000-000000000001'
const now = new Date('2026-10-24T10:00:00.000Z')

describe('parsePixelBeacon', () => {
  it('accepts our events and id shapes only', () => {
    expect(
      parsePixelBeacon({
        name: 'ViewContent',
        eventId: uuid,
        url: 'https://w.in/p',
        variantId: uuid,
      }),
    ).toEqual({
      name: 'ViewContent',
      eventId: uuid,
      url: 'https://w.in/p',
      productId: null,
      variantId: uuid,
      quantity: null,
    })
    expect(parsePixelBeacon({ name: 'Lead', eventId: uuid })).toBeNull()
    expect(parsePixelBeacon({ name: 'Purchase', eventId: 'hello' })).toBeNull()
    expect(parsePixelBeacon(null)).toBeNull()
    const junk = parsePixelBeacon({
      name: 'PageView',
      eventId: uuid,
      url: 'javascript:alert(1)',
      variantId: 'x',
    })
    expect(junk).toMatchObject({ url: null, variantId: null })
  })
})

describe('firstPartyIds', () => {
  it('mints _fbp, keeps valid cookies, and takes a new ad click as _fbc', () => {
    const fresh = firstPartyIds({}, 'https://w.in/', now, 0.5)
    expect(fresh.fbp).toBe(`fb.1.${now.getTime()}.5000000000`)
    expect(fresh.set).toEqual(['fbp'])
    expect(fresh.fbc).toBeNull()

    const kept = firstPartyIds({ fbp: 'fb.1.1792800000000.1234567890' }, null, now, 0.5)
    expect(kept).toMatchObject({ fbp: 'fb.1.1792800000000.1234567890', set: [] })

    const clicked = firstPartyIds(
      { fbp: 'fb.1.1792800000000.1234567890' },
      'https://w.in/?fbclid=IwAR2abc',
      now,
      0.5,
    )
    expect(clicked).toMatchObject({
      fbc: `fb.1.${now.getTime()}.IwAR2abc`,
      fbclid: 'IwAR2abc',
      set: ['fbc'],
    })

    const same = firstPartyIds(
      { fbp: 'fb.1.1792800000000.1234567890', fbc: 'fb.1.1792700000000.IwAR2abc' },
      'https://w.in/?fbclid=IwAR2abc',
      now,
      0.5,
    )
    expect(same).toMatchObject({ fbc: 'fb.1.1792700000000.IwAR2abc', set: [] })
  })
})

describe('collectPixelEvent', () => {
  async function seed() {
    const [s] = await owner
      .insert(store)
      .values({
        slug: 'w',
        name: 'W',
        apps: { installed: ['pixels'] },
        preferences: { customerPrivacy: { bannerVersion: 3 } },
      })
      .returning()
    const storeId = s?.id as string
    const [c] = await owner.insert(cart).values({ storeId }).returning()
    const [withToken, browserOnly, paused, noView] = await owner
      .insert(pixelConnection)
      .values([
        { storeId, pixelId: '1111111111', tokenEnc: 'v2.x.y.z.w' },
        { storeId, pixelId: '2222222222' },
        { storeId, pixelId: '3333333333', tokenEnc: 'v2.x.y.z.w', status: 'paused' },
        {
          storeId,
          pixelId: '4444444444',
          tokenEnc: 'v2.x.y.z.w',
          events: ['PageView', 'Purchase'],
          purchaseTrigger: 'delivered',
        },
      ])
      .returning()
    return { storeId, cartId: c?.id as string, withToken, browserOnly, paused, noView }
  }

  const tracking = {
    fbp: 'fb.1.1792800000000.1234567890',
    ip: '203.0.113.7',
    ua: 'UA',
    consent: { marketing: true, analytics: false, version: 3, at: now.toISOString() },
  }

  it('stamps the cart and plans server copies for pixels with a token and the event on', async () => {
    const s = await seed()
    const beacon = parsePixelBeacon({ name: 'ViewContent', eventId: uuid, variantId: uuid })
    const jobs = await withStore(app, s.storeId, (tx) =>
      collectPixelEvent(tx, {
        storeId: s.storeId,
        beacon: beacon as NonNullable<typeof beacon>,
        cartId: s.cartId,
        visitorId: uuid,
        tracking,
        now,
      }),
    )
    expect(jobs.map((j) => j.connectionId)).toEqual([s.withToken?.id])
    expect(jobs[0]).toMatchObject({
      origin: 'storefront',
      eventName: 'ViewContent',
      eventId: uuid,
      fbp: tracking.fbp,
    })
    // No email, phone or address in the job.
    expect(Object.keys(jobs[0] ?? {})).not.toContain('email')
    const [c] = await owner.select().from(cart)
    expect(c?.tracking).toEqual(tracking)
    expect(await withStore(app, s.storeId, (tx) => collectorStore(tx, s.storeId))).toEqual({
      installed: true,
      bannerVersion: 3,
    })
  })

  it('never plans a server Purchase (the order job sends it)', async () => {
    const s = await seed()
    const beacon = parsePixelBeacon({ name: 'Purchase', eventId: `ord_${uuid}` })
    const jobs = await withStore(app, s.storeId, (tx) =>
      collectPixelEvent(tx, {
        storeId: s.storeId,
        beacon: beacon as NonNullable<typeof beacon>,
        cartId: null,
        visitorId: null,
        tracking,
        now,
      }),
    )
    expect(jobs).toEqual([])
  })

  it('gives the browser every pixel but paused ones, Purchase only for "placed"', async () => {
    const s = await seed()
    const pixels = await withStore(app, s.storeId, (tx) => browserPixels(tx))
    expect(pixels.map((p) => p.id).sort()).toEqual(['1111111111', '2222222222', '4444444444'])
    expect(pixels.find((p) => p.id === '4444444444')?.browserPurchase).toBe(false)
    expect(pixels.find((p) => p.id === '1111111111')?.browserPurchase).toBe(true)
    expect(JSON.stringify(pixels)).not.toContain('v2.')
  })
})
