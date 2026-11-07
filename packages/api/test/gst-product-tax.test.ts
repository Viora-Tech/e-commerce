import { createMerchantAuth } from '@commerce/auth'
import { createDb, product, store, variant } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { call } from '@orpc/server'
import { eq } from 'drizzle-orm'
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
    .values({
      slug,
      name: slug,
      organizationId: org?.id as string,
      apps: { installed: ['gst-invoices'] },
    })
    .returning()
  return {
    ctx: { db: app, auth, headers, notifications: { add: async () => undefined } } as ApiContext,
    storeId: s?.id as string,
  }
}

/** A product with two variants, imported with tax off and no HSN, one variant with its own. */
async function seedProduct(storeId: string, title: string, hsCode: string | null = null) {
  const [p] = await owner
    .insert(product)
    .values({ storeId, handle: title.toLowerCase(), title, status: 'active' })
    .returning()
  await owner.insert(variant).values([
    { storeId, productId: p?.id as string, title: 'Black', pricePaise: 100000, taxable: false },
    {
      storeId,
      productId: p?.id as string,
      title: 'White',
      pricePaise: 100000,
      taxable: false,
      hsCode,
    },
  ])
  return p?.id as string
}

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('GST invoices Products tab', () => {
  it('lists each product with its GST switch, rate and HSN, and filters them', async () => {
    const m = await merchant('a@example.com', 'tax-list')
    await seedProduct(m.storeId, 'Pad')
    await seedProduct(m.storeId, 'Mouse', '8471')
    const list = (filter: 'all' | 'missing_hsn' | 'gst_off') =>
      call(appRouter.gstInvoicesProducts.list, { filter }, { context: m.ctx })
    const all = await list('all')
    expect(all.total).toBe(2)
    expect(all.storeRatePercent).toBe(18)
    const mouse = all.items.find((r) => r.title === 'Mouse')
    expect(mouse).toMatchObject({ charge: 'off', hsCode: '8471', missingHsn: 1, variants: 2 })
    expect((await list('missing_hsn')).total).toBe(2)
    expect((await list('gst_off')).total).toBe(2)
  })

  it('saves HSN and rate on the product, clears variant overrides and sets Charge GST', async () => {
    const m = await merchant('b@example.com', 'tax-save')
    const id = await seedProduct(m.storeId, 'Pad', '9999')
    await call(
      appRouter.gstInvoicesProducts.update,
      { target: { ids: [id] }, change: { hsCode: '70200090', gstRatePercent: 18, taxable: true } },
      { context: m.ctx },
    )
    const [p] = await owner.select().from(product).where(eq(product.id, id))
    expect(p).toMatchObject({ hsCode: '70200090', gstRatePercent: 18 })
    const vs = await owner.select().from(variant).where(eq(variant.productId, id))
    expect(vs.every((v) => v.taxable && v.hsCode === null && v.gstRatePercent === null)).toBe(true)
    const after = await call(
      appRouter.gstInvoicesProducts.list,
      { filter: 'missing_hsn' },
      { context: m.ctx },
    )
    expect(after.total).toBe(0)
  })

  it('changes every product a filter matches, and only those', async () => {
    const m = await merchant('c@example.com', 'tax-match')
    await seedProduct(m.storeId, 'Pad')
    const other = await seedProduct(m.storeId, 'Mouse')
    await call(
      appRouter.gstInvoicesProducts.update,
      { target: { ids: [other] }, change: { taxable: true } },
      { context: m.ctx },
    )
    const r = await call(
      appRouter.gstInvoicesProducts.update,
      { target: { match: { filter: 'gst_off' } }, change: { gstRatePercent: 5 } },
      { context: m.ctx },
    )
    expect(r.products).toBe(1)
    const [mouse] = await owner.select().from(product).where(eq(product.id, other))
    expect(mouse?.gstRatePercent).toBeNull()
  })

  it('refuses an HSN that is not 4 to 8 digits', async () => {
    const m = await merchant('d@example.com', 'tax-bad')
    const id = await seedProduct(m.storeId, 'Pad')
    await expect(
      call(
        appRouter.gstInvoicesProducts.update,
        { target: { ids: [id] }, change: { hsCode: '12' } },
        { context: m.ctx },
      ),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })
})
