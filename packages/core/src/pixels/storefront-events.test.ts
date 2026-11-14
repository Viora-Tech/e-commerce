/** SOURCE OF TRUTH: Pixels storefront event tests — WHAT: page URLs reach Meta without tokens or contact details, an AddToCart is worth the units just added, an AddPaymentInfo the cart with the browser's event id, and a marketing yes taken back before checkout keeps the order's Purchase off / WHY: the value and consent rules the browser and server copies must share */
import {
  cart,
  cartLine,
  createDb,
  customer,
  pixelConnection,
  product,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { encryptSecret } from '../secrets'
import {
  addPaymentInfoEventId,
  hasMarketingConsent,
  pixelPageUrl,
  purchaseSkipReason,
} from './client'
import {
  collectPixelEvent,
  parsePixelBeacon,
  shopperMatchFacts,
  syncCartMarketingConsent,
  withdrawCartMarketingConsent,
} from './collect'
import type { FetchLike } from './meta'
import { runPixelSendJob } from './send'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const SECRET = 'pixels-test-settings-secret-000000000000'

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const uuid = '0199a000-0000-7000-8000-000000000001'
const now = new Date('2026-10-24T10:00:00.000Z')
const consent = { marketing: true, analytics: false, version: 1, at: now.toISOString() }

describe('page URLs sent to Meta', () => {
  it('keep campaign tags and click ids, drop tokens, contact details and the fragment', () => {
    expect(
      pixelPageUrl(
        'https://w.in/checkout/thank-you/1042?t=secret.token&utm_source=ig&fbclid=IwAR2&email=a%40b.in#pay',
      ),
    ).toBe('https://w.in/checkout/thank-you/1042?utm_source=ig&fbclid=IwAR2')
    expect(pixelPageUrl('https://user:pw@w.in/search?q=asha+9876543210')).toBe(
      'https://w.in/search',
    )
    expect(pixelPageUrl('javascript:alert(1)')).toBeNull()
    expect(pixelPageUrl(`https://w.in/${'x'.repeat(2000)}`)).toBeNull()
  })

  it('the beacon carries the clean URL, and a quantity only for AddToCart', () => {
    const add = parsePixelBeacon({
      name: 'AddToCart',
      eventId: `atc_${uuid}_1`,
      url: 'https://w.in/products/pad?variant=1&token=x',
      variantId: uuid,
      quantity: 2,
    })
    expect(add).toMatchObject({ url: 'https://w.in/products/pad?variant=1', quantity: 2 })
    expect(
      parsePixelBeacon({ name: 'AddToCart', eventId: `atc_${uuid}_1`, quantity: 1.5 })?.quantity,
    ).toBeNull()
    expect(parsePixelBeacon({ name: 'PageView', eventId: uuid, quantity: 3 })?.quantity).toBeNull()
  })
})

async function seedCart() {
  const [s] = await owner
    .insert(store)
    .values({ slug: 'w', name: 'W', apps: { installed: ['pixels'] } })
    .returning()
  const storeId = s?.id as string
  const [p] = await owner.insert(product).values({ storeId, handle: 'p', title: 'P' }).returning()
  const [v] = await owner
    .insert(variant)
    .values({ storeId, productId: p?.id as string, title: 'V', pricePaise: 49_900 })
    .returning()
  const [c] = await owner.insert(cart).values({ storeId, tracking: { consent } }).returning()
  // Two were in the cart already; the shopper just added one more.
  await owner.insert(cartLine).values({
    storeId,
    cartId: c?.id as string,
    variantId: v?.id as string,
    quantity: 3,
    unitPricePaise: 49_900,
  })
  const [px] = await owner
    .insert(pixelConnection)
    .values({ storeId, pixelId: '1234567890', tokenEnc: encryptSecret('EAAfake', SECRET) })
    .returning()
  return { storeId, cartId: c?.id as string, variantId: v?.id as string, px: px?.id as string }
}

describe('AddToCart value', () => {
  it('is the units just added, as the browser copy says, not the whole line', async () => {
    const s = await seedCart()
    const beacon = parsePixelBeacon({
      name: 'AddToCart',
      eventId: `atc_${s.variantId}_3`,
      variantId: s.variantId,
      quantity: 1,
    })
    const [job] = await withStore(app, s.storeId, (tx) =>
      collectPixelEvent(tx, {
        storeId: s.storeId,
        beacon: beacon as NonNullable<typeof beacon>,
        cartId: s.cartId,
        visitorId: null,
        tracking: { consent },
        now,
      }),
    )
    expect(job).toMatchObject({ connectionId: s.px, quantity: 1 })
    const calls: unknown[] = []
    const fetch: FetchLike = async (_url, init) => {
      calls.push(JSON.parse(String(init.body)))
      return new Response(JSON.stringify({ events_received: 1 }), { status: 200 })
    }
    if (!job) throw new Error('no job')
    expect(await runPixelSendJob(app, job, { settingsSecret: SECRET, fetch, now })).toBe('sent')
    const sent = (calls[0] as { data: { custom_data: Record<string, unknown> }[] }).data[0]
    expect(sent?.custom_data).toMatchObject({ currency: 'INR', value: 499, num_items: 1 })
  })
})

describe('AddPaymentInfo', () => {
  it('goes to pixels that have it on, worth the cart, with the browser event id', async () => {
    const s = await seedCart()
    // A pixel added before the event existed keeps its five events until the merchant ticks it.
    const [old] = await owner
      .insert(pixelConnection)
      .values({
        storeId: s.storeId,
        pixelId: '9876543210',
        tokenEnc: encryptSecret('EAAx', SECRET),
      })
      .returning()
    await owner
      .update(pixelConnection)
      .set({
        events: ['PageView', 'ViewContent', 'AddToCart', 'InitiateCheckout', 'AddPaymentInfo'],
      })
      .where(eq(pixelConnection.id, s.px))
    const eventId = addPaymentInfoEventId(s.cartId, 'cod')
    const beacon = parsePixelBeacon({ name: 'AddPaymentInfo', eventId, quantity: 2 })
    expect(beacon).toMatchObject({ name: 'AddPaymentInfo', eventId, quantity: null })
    const jobs = await withStore(app, s.storeId, (tx) =>
      collectPixelEvent(tx, {
        storeId: s.storeId,
        beacon: beacon as NonNullable<typeof beacon>,
        cartId: s.cartId,
        visitorId: null,
        tracking: { consent },
        now,
      }),
    )
    expect(jobs.map((j) => j.connectionId)).toEqual([s.px])
    expect(jobs.map((j) => j.connectionId)).not.toContain(old?.id)
    const calls: unknown[] = []
    const fetch: FetchLike = async (_url, init) => {
      calls.push(JSON.parse(String(init.body)))
      return new Response(JSON.stringify({ events_received: 1 }), { status: 200 })
    }
    const [job] = jobs
    if (!job) throw new Error('no job')
    expect(await runPixelSendJob(app, job, { settingsSecret: SECRET, fetch, now })).toBe('sent')
    const sent = (calls[0] as { data: Record<string, unknown>[] }).data[0]
    expect(sent).toMatchObject({ event_name: 'AddPaymentInfo', event_id: eventId })
    expect(sent?.custom_data).toMatchObject({
      currency: 'INR',
      value: 1497,
      content_ids: [s.variantId],
    })
    // The same pick again is the same event: logged once, not sent twice.
    expect(await runPixelSendJob(app, job, { settingsSecret: SECRET, fetch, now })).toBe('sent')
    expect(calls).toHaveLength(1)
  })
})

describe('consent at checkout', () => {
  it('a yes taken back before paying turns the cart (and so the order) off', async () => {
    const s = await seedCart()
    const read = async () =>
      (await owner.select().from(cart).where(eq(cart.id, s.cartId)))[0]?.tracking ?? null
    await withStore(app, s.storeId, (tx) => withdrawCartMarketingConsent(tx, s.cartId, true, now))
    expect(hasMarketingConsent(await read())).toBe(true)
    await withStore(app, s.storeId, (tx) => withdrawCartMarketingConsent(tx, s.cartId, false, now))
    const after = await read()
    expect(hasMarketingConsent(after)).toBe(false)
    expect(after?.consent?.version).toBe(1)
  })

  const FBP = 'fb.1.1729764000000.1234567890'
  const FBC = 'fb.1.1729764000000.IwAR2abc'
  const facts = { isTest: false, importedFrom: null, placedAt: now }

  async function bareCart() {
    const s = await seedCart()
    const [c] = await owner.insert(cart).values({ storeId: s.storeId }).returning()
    const cartId = c?.id as string
    const read = async () =>
      (await owner.select().from(cart).where(eq(cart.id, cartId)))[0]?.tracking ?? null
    return { storeId: s.storeId, cartId, read }
  }

  it('a yes with no collector stamp: the order still gets tracking, so Purchase is not skipped', async () => {
    const c = await bareCart()
    await withStore(app, c.storeId, (tx) =>
      syncCartMarketingConsent(
        tx,
        c.cartId,
        {
          consent: { marketing: true, analytics: true, version: 2 },
          fbp: FBP,
          fbc: FBC,
          ip: '203.0.113.9',
          ua: 'Mozilla/5.0',
        },
        now,
      ),
    )
    const t = await c.read()
    expect(t).toMatchObject({
      fbp: FBP,
      fbc: FBC,
      fbclid: 'IwAR2abc',
      ip: '203.0.113.9',
      ua: 'Mozilla/5.0',
    })
    expect(t?.consent).toMatchObject({ marketing: true, version: 2 })
    expect(purchaseSkipReason({ ...facts, tracking: t }, now)).toBeNull()
  })

  it('a yes keeps what the collector stamped earlier and ignores malformed cookies', async () => {
    const s = await seedCart()
    await owner
      .update(cart)
      .set({ tracking: { consent, fbp: FBP, landingUrl: 'https://w.in/?utm_source=ig' } })
      .where(eq(cart.id, s.cartId))
    await withStore(app, s.storeId, (tx) =>
      syncCartMarketingConsent(
        tx,
        s.cartId,
        {
          consent: { marketing: true, analytics: false, version: 1 },
          fbp: 'fb.1.999.1',
          fbc: 'junk',
        },
        now,
      ),
    )
    const [row] = await owner.select().from(cart).where(eq(cart.id, s.cartId))
    expect(row?.tracking).toMatchObject({ fbp: FBP, landingUrl: 'https://w.in/?utm_source=ig' })
    expect(row?.tracking?.fbc).toBeUndefined()
  })

  it('no yes: nothing about the browser is kept, and the skip says no consent', async () => {
    const c = await bareCart()
    await withStore(app, c.storeId, (tx) =>
      syncCartMarketingConsent(
        tx,
        c.cartId,
        { consent: null, fbp: FBP, fbc: FBC, ip: '203.0.113.9', ua: 'Mozilla/5.0' },
        now,
      ),
    )
    const t = await c.read()
    expect(t).toEqual({
      consent: { marketing: false, analytics: false, version: 0, at: now.toISOString() },
    })
    expect(purchaseSkipReason({ ...facts, tracking: t }, now)).toBe('no_consent')
  })

  it('a no withdraws an earlier yes without touching the rest', async () => {
    const s = await seedCart()
    await withStore(app, s.storeId, (tx) =>
      syncCartMarketingConsent(
        tx,
        s.cartId,
        { consent: { marketing: false, analytics: true, version: 1 }, fbp: FBP },
        now,
      ),
    )
    const [row] = await owner.select().from(cart).where(eq(cart.id, s.cartId))
    expect(hasMarketingConsent(row?.tracking)).toBe(false)
    expect(row?.tracking?.fbp).toBeUndefined()
  })
})

describe('shopper facts for browser matching', () => {
  it('checkout contact first, then the signed-in customer and their latest address', async () => {
    const s = await seedCart()
    const [c] = await owner
      .insert(customer)
      .values({
        storeId: s.storeId,
        email: 'asha@example.com',
        name: 'Asha Rao',
        defaultAddress: {
          name: 'Asha Rao',
          line1: '1 MG Road',
          city: 'Pune',
          stateCode: 'MH',
          pincode: '411001',
          phone: '9876543210',
        },
      })
      .returning()
    const me = { id: c?.id as string, email: 'asha@example.com', phone: null, name: 'Asha Rao' }
    await owner
      .update(cart)
      .set({ email: 'typed@example.com', phone: '9123456789' })
      .where(eq(cart.id, s.cartId))
    const facts = await withStore(app, s.storeId, (tx) =>
      shopperMatchFacts(tx, { customer: me, cartId: s.cartId, visitorId: 'v1' }),
    )
    expect(facts).toMatchObject({
      email: 'typed@example.com',
      phone: '9123456789',
      name: 'Asha Rao',
      city: 'Pune',
      state: 'MH',
      pincode: '411001',
      externalId: me.id,
    })
    const guest = await withStore(app, s.storeId, (tx) =>
      shopperMatchFacts(tx, { customer: null, cartId: null, visitorId: 'v1' }),
    )
    expect(guest).toMatchObject({ externalId: 'v1' })
    expect(guest.email).toBeUndefined()
  })
})
