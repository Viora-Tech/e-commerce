import { createMerchantAuth } from '@commerce/auth'
import {
  collection,
  collectionProduct,
  createDb,
  inventoryLevel,
  newId,
  product,
  store,
  variant,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { call } from '@orpc/server'
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

type Seed = { title: string; vendor: string; tags: string[]; pricePaise: number; sku: string }

async function seedProduct(storeId: string, p: Seed) {
  const productId = newId()
  await owner.insert(product).values({
    id: productId,
    storeId,
    title: p.title,
    handle: `p-${productId}`,
    vendor: p.vendor,
    tags: p.tags,
    status: 'active',
  })
  const variantId = newId()
  await owner.insert(variant).values({
    id: variantId,
    storeId,
    productId,
    title: 'Default',
    pricePaise: p.pricePaise,
    sku: p.sku,
  })
  await owner.insert(inventoryLevel).values({ storeId, variantId, onHand: 5 })
  return productId
}

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('catalog list filters', () => {
  it('filters products and inventory by several vendors, tags, a collection and price', async () => {
    const m = await merchant('filters@example.com', 'filters-a')
    const pad = await seedProduct(m.storeId, {
      title: 'Glasspad',
      vendor: 'Acme',
      tags: ['glass', 'sale'],
      pricePaise: 250_000,
      sku: 'GP-170',
    })
    const mouse = await seedProduct(m.storeId, {
      title: 'Mouse',
      vendor: 'Bolt',
      tags: ['wired'],
      pricePaise: 90_000,
      sku: 'MS-1',
    })
    await seedProduct(m.storeId, {
      title: 'Keyboard',
      vendor: 'Crate',
      tags: [],
      pricePaise: 500_000,
      sku: 'KB-1',
    })
    const collectionId = newId()
    await owner
      .insert(collection)
      .values({ id: collectionId, storeId: m.storeId, title: 'Pads', handle: 'pads' })
    await owner
      .insert(collectionProduct)
      .values({ storeId: m.storeId, collectionId, productId: pad })

    const ids = async (input: Record<string, unknown>) =>
      (await call(appRouter.products.list, input, { context: m.ctx })).items.map((i) => i.id)

    expect(new Set(await ids({ vendors: ['Acme', 'Bolt'] }))).toEqual(new Set([pad, mouse]))
    expect(await ids({ tags: ['sale', 'nothing'] })).toEqual([pad])
    expect(await ids({ collectionIds: [collectionId] })).toEqual([pad])
    expect(await ids({ priceMinPaise: 50_000, priceMaxPaise: 100_000 })).toEqual([mouse])
    expect(await ids({ search: 'gp-17' })).toEqual([pad])
    expect(await ids({ createdFrom: new Date(Date.now() + 86_400_000).toISOString() })).toEqual([])

    const facets = await call(appRouter.products.facets, undefined, { context: m.ctx })
    expect(facets.collections).toEqual([{ id: collectionId, title: 'Pads' }])

    const [loc] = await call(appRouter.inventory.locations, undefined, { context: m.ctx })
    const locationId = loc?.id as string
    const rows = async (input: Record<string, unknown>) =>
      (await call(appRouter.inventory.list, { locationId, ...input }, { context: m.ctx })).rows.map(
        (r) => r.productId,
      )
    expect(new Set(await rows({ vendors: ['Acme', 'Bolt'] }))).toEqual(new Set([pad, mouse]))
    expect(await rows({ tags: ['wired'] })).toEqual([mouse])
    expect(await rows({ collectionIds: [collectionId] })).toEqual([pad])
    expect(await rows({ productStatus: ['draft'] })).toEqual([])

    const invFacets = await call(appRouter.inventory.facets, undefined, { context: m.ctx })
    expect(invFacets.tags).toEqual(['glass', 'sale', 'wired'])
  })
})
