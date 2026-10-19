import { createMerchantAuth } from '@commerce/auth'
import { createDb, store } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { call } from '@orpc/server'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { ApiContext } from '../src/context'
import { appRouter } from '../src/routers/_app'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const sent: { otp: string }[] = []
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
  return {
    ctx: { db: app, auth, headers, notifications: { add: async () => undefined } } as ApiContext,
    storeId: s?.id as string,
  }
}

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

type Ctx = Awaited<ReturnType<typeof merchant>>['ctx']

async function seedProduct(ctx: Ctx, title: string, sizes: string[]) {
  await call(
    appRouter.products.save,
    {
      title,
      status: 'active',
      options: [{ name: 'Size', values: sizes.map((value) => ({ value })) }],
      variants: sizes.map((size) => ({
        optionValues: [size],
        sku: `${title}-${size}`.toUpperCase(),
        pricePaise: 100_000,
      })),
    },
    { context: ctx },
  )
}

describe('products.searchVariants', () => {
  // #501: the draft order picker capped variant rows, so a product with many sizes lost some.
  it('returns every variant of each matching product, capping products rather than rows', async () => {
    const { ctx } = await merchant('sv-a@example.com', 'sv-a')
    const sizes = Array.from({ length: 12 }, (_, i) => `S${i + 1}`)
    await seedProduct(ctx, 'Glasspad', sizes)
    await seedProduct(ctx, 'Glove', ['M'])

    const rows = await call(
      appRouter.products.searchVariants,
      { search: 'gl', limit: 1 },
      { context: ctx },
    )
    expect(rows.map((r) => r.variantTitle)).toEqual(sizes)
    expect(new Set(rows.map((r) => r.title))).toEqual(new Set(['Glasspad']))
  })

  it('matches on a variant title too', async () => {
    const { ctx } = await merchant('sv-b@example.com', 'sv-b')
    await seedProduct(ctx, 'Glasspad', ['Large', 'Small'])
    const rows = await call(
      appRouter.products.searchVariants,
      { search: 'large' },
      { context: ctx },
    )
    expect(rows.map((r) => r.variantTitle)).toEqual(['Large', 'Small'])
  })
})

describe('products.list ids', () => {
  // #516: the discount picker loads the products it already covers by id, not from page one.
  it('returns exactly the asked-for products', async () => {
    const { ctx } = await merchant('pl-a@example.com', 'pl-a')
    await seedProduct(ctx, 'Glasspad', ['M'])
    await seedProduct(ctx, 'Glove', ['M'])
    await seedProduct(ctx, 'Mouse', ['M'])
    const all = await call(appRouter.products.list, { perPage: 10 }, { context: ctx })
    const picked = all.items.filter((p) => p.title !== 'Glove').map((p) => p.id)

    const rows = await call(
      appRouter.products.list,
      { ids: picked, perPage: picked.length },
      { context: ctx },
    )
    expect(new Set(rows.items.map((p) => p.title))).toEqual(new Set(['Glasspad', 'Mouse']))
  })
})
