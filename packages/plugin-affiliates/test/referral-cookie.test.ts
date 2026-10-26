import {
  decodeAttribution,
  decodeReferral,
  encodeAttribution,
  encodeReferral,
  setCartAttribution,
  withReferral,
} from '@commerce/core'
import {
  address,
  cart,
  createDb,
  customer,
  order,
  orderLine,
  product,
  type StoreTx,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { applyAsAffiliate } from '../src/affiliates'
import { creditOrder } from '../src/commissions'
import { type AffiliateSettings, defaultAffiliateSettings } from '../src/settings'

/*
 * A shopper who said no to analytics has no `wc_attr` touch at all; the functional referral
 * cookie (`wc_ref`, set by the storefront proxy on a `?ref=` landing) is all that remains. These
 * run the storefront's `readAttribution` rule (`withReferral` over both cookies) into a real cart
 * and order, and check the affiliate is credited.
 */

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const SECRET = 'test-secret-test-secret-test-secret-00'
const settings: AffiliateSettings = { ...defaultAffiliateSettings, approval: 'auto' }
const DAY = 86_400_000

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const inStore = <T>(storeId: string, fn: (tx: StoreTx) => Promise<T>) => withStore(app, storeId, fn)

async function seed() {
  const slug = `s-${Math.random().toString(36).slice(2)}`
  const [s] = await owner.insert(store).values({ slug, name: slug }).returning()
  if (!s) throw new Error('seed')
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'mat', title: 'Mat' })
    .returning()
  const [v] = await owner
    .insert(variant)
    .values({ storeId: s.id, productId: p?.id as string, title: 'Default', pricePaise: 1180_00 })
    .returning()
  const [c] = await owner
    .insert(customer)
    .values({ storeId: s.id, email: 'asha@example.com', name: 'Asha' })
    .returning()
  const a = await inStore(s.id, (tx) =>
    applyAsAffiliate(
      tx,
      s.id,
      {
        customerId: c?.id ?? null,
        email: 'asha@example.com',
        phone: '+91 98765 43210',
        name: 'Asha K',
        social: '@asha',
        message: '',
      },
      settings,
      SECRET,
    ),
  )
  return { storeId: s.id, variantId: v?.id as string, code: a.code }
}

let numbers = 5000

/**
 * Checkout as the storefront does it: the touch from the shopper's cookies goes on the cart
 * (`setCartAttribution`), and the order is placed with the cart's attribution.
 */
async function checkout(
  storeId: string,
  variantId: string,
  cookies: { wc_attr?: string; wc_ref?: string },
) {
  const touch = withReferral(decodeAttribution(cookies.wc_attr), decodeReferral(cookies.wc_ref))
  const [c] = await owner.insert(cart).values({ storeId }).returning()
  if (!c) throw new Error('cart')
  await inStore(storeId, (tx) => setCartAttribution(tx, c.id, touch))
  const [saved] = await owner.select().from(cart).where(eq(cart.id, c.id))
  const [addr] = await owner
    .insert(address)
    .values({
      storeId,
      name: 'Buyer',
      line1: '5 Park Street',
      city: 'Kolkata',
      stateCode: 'WB',
      pincode: '700016',
      phone: '9000000001',
    })
    .returning()
  const [o] = await owner
    .insert(order)
    .values({
      storeId,
      number: numbers++,
      email: 'buyer@example.com',
      shippingAddressId: addr?.id,
      status: 'open',
      paymentStatus: 'paid',
      subtotalPaise: 1180_00,
      totalPaise: 1180_00,
      attribution: saved?.attribution ?? null,
    })
    .returning()
  if (!o) throw new Error('order')
  await owner.insert(orderLine).values({
    storeId,
    orderId: o.id,
    variantId,
    quantity: 1,
    unitPricePaise: 1180_00,
    gstRatePercent: 18,
  })
  return inStore(storeId, (tx) => creditOrder(tx, storeId, o.id, settings, SECRET))
}

describe('affiliate referral cookie without analytics consent', () => {
  it('credits the affiliate for a shopper who declined analytics (no wc_attr, only wc_ref)', async () => {
    const s = await seed()
    const clicked = new Date(Date.now() - 2 * DAY)
    const commission = await checkout(s.storeId, s.variantId, {
      wc_ref: encodeReferral({ code: s.code, at: clicked }),
    })
    expect(commission).toMatchObject({ source: 'link', status: 'pending', commissionPaise: 100_00 })
  })

  it('earns nothing once the click is older than the link window', async () => {
    const s = await seed()
    const clicked = new Date(Date.now() - (settings.cookieDays + 1) * DAY)
    const commission = await checkout(s.storeId, s.variantId, {
      wc_ref: encodeReferral({ code: s.code, at: clicked }),
    })
    expect(commission).toBeNull()
  })

  it('keeps last click: a later email touch (consented shopper) wins over an older affiliate click', async () => {
    const s = await seed()
    const commission = await checkout(s.storeId, s.variantId, {
      wc_ref: encodeReferral({ code: s.code, at: new Date(Date.now() - 3 * DAY) }),
      wc_attr: encodeAttribution({
        channel: 'email',
        source: 'newsletter',
        at: new Date(Date.now() - DAY).toISOString(),
      }),
    })
    expect(commission).toBeNull()
  })

  it('without either cookie, no affiliate earns', async () => {
    const s = await seed()
    expect(await checkout(s.storeId, s.variantId, {})).toBeNull()
  })
})
