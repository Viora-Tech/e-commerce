import { createMerchantAuth } from '@commerce/auth'
import { INDIAN_STATE_NAMES } from '@commerce/core/states'
import {
  createDb,
  media,
  newId,
  product,
  productMedia,
  shippingRate,
  shippingZone,
  store,
  variant,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { call } from '@orpc/server'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { ApiContext } from '../src/context'
import { appRouter } from '../src/routers/_app'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

const sent: { email: string; otp: string }[] = []
const auth = createMerchantAuth({
  db: app,
  baseURL: 'http://localhost:3200',
  secret: 'test-secret-test-secret-test-secret-1234',
  sendOtp: async (m) => {
    sent.push(m)
  },
})

async function merchant(email: string, slug: string) {
  await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })
  const res = await auth.api.signInEmailOTP({
    body: { email, otp: sent.at(-1)?.otp as string },
    asResponse: true,
  })
  const headers = new Headers({ cookie: res.headers.get('set-cookie') ?? '' })
  const org = await auth.api.createOrganization({ headers, body: { name: slug, slug } })
  await auth.api.setActiveOrganization({ headers, body: { organizationId: org?.id as string } })
  const [s] = await owner
    .insert(store)
    .values({ slug, name: slug, organizationId: org?.id as string })
    .returning()
  const ctx: ApiContext = { db: app, auth, headers, notifications: { add: async () => undefined } }
  return { ctx, storeId: s?.id as string }
}

type Seed = {
  title: string
  status?: 'active' | 'draft'
  pricePaise: number
  weightGrams: number | null
  image: boolean
}

async function seedProduct(storeId: string, p: Seed) {
  const productId = newId()
  await owner.insert(product).values({
    id: productId,
    storeId,
    title: p.title,
    handle: `p-${productId}`,
    status: p.status ?? 'active',
  })
  await owner.insert(variant).values({
    storeId,
    productId,
    title: 'Default',
    pricePaise: p.pricePaise,
    weightGrams: p.weightGrams,
  })
  if (p.image) {
    const mediaId = newId()
    await owner
      .insert(media)
      .values({ id: mediaId, storeId, url: `https://cdn.example.com/${productId}.jpg` })
    await owner.insert(productMedia).values({ storeId, productId, mediaId })
  }
  return productId
}

/** Waimers, 2026-10-21: two imported "All India" zones listing every state, no rates, ahead of
 *  the everywhere zone that holds the only rate. */
async function seedWaimersZones(storeId: string) {
  const states = Object.keys(INDIAN_STATE_NAMES)
  const [a] = await owner
    .insert(shippingZone)
    .values({ storeId, name: 'All India', stateCodes: states, position: 0 })
    .returning()
  const [b] = await owner
    .insert(shippingZone)
    .values({ storeId, name: 'All India', stateCodes: states, position: 1 })
    .returning()
  const [rest] = await owner
    .insert(shippingZone)
    .values({ storeId, name: 'Rest of India', position: 2 })
    .returning()
  await owner
    .insert(shippingRate)
    .values({ storeId, zoneId: rest?.id as string, name: 'Standard', pricePaise: 5_000 })
  return { a: a?.id as string, b: b?.id as string }
}

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('store.health', () => {
  it('finds the Waimers setup, product gaps and a test-mode gateway, with severities', async () => {
    const m = await merchant('health@example.com', 'health-a')
    const zones = await seedWaimersZones(m.storeId)
    await owner
      .update(store)
      .set({
        shipping: { enabled: ['fake'], policy: { originPincode: '560001' } },
        payments: {
          enabled: ['razorpay', 'cod'],
          providers: { razorpay: { keyId: 'rzp_test_abc123', keySecret: 'secret' } },
        },
      })
      .where(eq(store.id, m.storeId))
    await seedProduct(m.storeId, {
      title: 'Mug',
      pricePaise: 50_000,
      weightGrams: 300,
      image: true,
    })
    await seedProduct(m.storeId, {
      title: 'Tee',
      pricePaise: 80_000,
      weightGrams: null,
      image: true,
    })
    await seedProduct(m.storeId, {
      title: 'Poster',
      pricePaise: 20_000,
      weightGrams: 0,
      image: false,
    })
    await seedProduct(m.storeId, { title: 'Sticker', pricePaise: 0, weightGrams: 10, image: true })
    // Drafts are not checked.
    await seedProduct(m.storeId, {
      title: 'Draft',
      status: 'draft',
      pricePaise: 0,
      weightGrams: null,
      image: false,
    })

    const report = await call(appRouter.store.health, undefined, { context: m.ctx })

    expect(report.issues.map((i) => [i.code, i.severity])).toEqual([
      ['gateway_test_mode', 'blocks_checkout'],
      ['zone_no_rates', 'should_fix'],
      ['zone_no_rates', 'should_fix'],
      ['zones_overlap', 'should_fix'],
      ['no_courier', 'should_fix'],
      ['variants_no_weight', 'should_fix'],
      ['products_no_price', 'should_fix'],
      ['policies_missing', 'should_fix'],
      ['products_no_image', 'nice_to_have'],
      ['no_sender_email', 'nice_to_have'],
    ])
    expect(report.counts).toEqual({ blocks_checkout: 1, should_fix: 7, nice_to_have: 2 })
    const byCode = (code: string) => report.issues.filter((i) => i.code === code)
    expect(byCode('zone_no_rates').map((i) => 'zoneId' in i && i.zoneId)).toEqual([
      zones.a,
      zones.b,
    ])
    expect(byCode('zones_overlap')[0]).toMatchObject({ zoneIds: [zones.a, zones.b] })
    // Tee (no weight) and Poster (0 g): two variants on two products.
    expect(byCode('variants_no_weight')[0]).toMatchObject({ variants: 2, products: 2 })
    expect(byCode('products_no_price')[0]).toMatchObject({ products: 1 })
    expect(byCode('products_no_image')[0]).toMatchObject({ products: 1 })
    // The everywhere zone has a rate, so every state can still check out.
    expect(byCode('states_uncovered')).toEqual([])
  })

  it('blocks checkout for states no zone with a rate reaches, and flags a missing origin', async () => {
    const m = await merchant('health-b@example.com', 'health-b')
    const [z] = await owner
      .insert(shippingZone)
      .values({ storeId: m.storeId, name: 'South', stateCodes: ['KA', 'TN'] })
      .returning()
    await owner
      .insert(shippingRate)
      .values({ storeId: m.storeId, zoneId: z?.id as string, name: 'Standard', pricePaise: 5_000 })

    const report = await call(appRouter.store.health, undefined, { context: m.ctx })
    const uncovered = report.issues.find((i) => i.code === 'states_uncovered')

    expect(uncovered?.severity).toBe('blocks_checkout')
    expect(uncovered && 'stateCodes' in uncovered ? uncovered.stateCodes : []).not.toContain('KA')
    expect(report.issues.map((i) => i.code)).toContain('no_origin_pincode')
    // Never saved payments: cash on delivery only.
    expect(report.issues.map((i) => i.code)).toContain('no_online_payment')
  })
})

describe('products.list missing filter', () => {
  it('lists products with a weightless variant, or with no image', async () => {
    const m = await merchant('missing@example.com', 'missing-a')
    const mug = await seedProduct(m.storeId, {
      title: 'Mug',
      pricePaise: 50_000,
      weightGrams: 300,
      image: true,
    })
    const tee = await seedProduct(m.storeId, {
      title: 'Tee',
      pricePaise: 80_000,
      weightGrams: null,
      image: true,
    })
    const poster = await seedProduct(m.storeId, {
      title: 'Poster',
      pricePaise: 20_000,
      weightGrams: 0,
      image: false,
    })
    const draft = await seedProduct(m.storeId, {
      title: 'Draft',
      status: 'draft',
      pricePaise: 100,
      weightGrams: null,
      image: false,
    })

    const ids = async (input: Record<string, unknown>) =>
      new Set(
        (await call(appRouter.products.list, input, { context: m.ctx })).items.map((i) => i.id),
      )

    expect(await ids({ missing: 'weight' })).toEqual(new Set([tee, poster, draft]))
    expect(await ids({ missing: 'weight', status: 'active' })).toEqual(new Set([tee, poster]))
    expect(await ids({ missing: 'image' })).toEqual(new Set([poster, draft]))
    expect(await ids({ missing: 'image', status: 'active' })).toEqual(new Set([poster]))
    expect((await call(appRouter.products.list, {}, { context: m.ctx })).total).toBe(4)
    // No box: every variant without a box from Settings › Shipping.
    expect(await ids({ missing: 'box' })).toEqual(new Set([mug, tee, poster, draft]))
    await owner.update(variant).set({ boxPresetId: 'mug-box' }).where(eq(variant.productId, mug))
    expect(await ids({ missing: 'box' })).toEqual(new Set([tee, poster, draft]))
  })
})
