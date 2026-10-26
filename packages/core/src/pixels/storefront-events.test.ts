/** SOURCE OF TRUTH: Pixels storefront event tests — WHAT: page URLs reach Meta without tokens or contact details, an AddToCart is worth the units just added, and a marketing yes taken back before checkout keeps the order's Purchase off / WHY: the value and consent rules the browser and server copies must share */
import {
  cart,
  cartLine,
  createDb,
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
import { hasMarketingConsent, pixelPageUrl } from './client'
import { collectPixelEvent, parsePixelBeacon, withdrawCartMarketingConsent } from './collect'
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
})
