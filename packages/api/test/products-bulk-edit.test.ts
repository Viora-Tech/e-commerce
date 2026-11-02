import { createMerchantAuth } from '@commerce/auth'
import { createDb, inventoryAdjustment, store, variant } from '@commerce/db'
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

async function seedProduct(ctx: Ctx, title: string, skus: string[]) {
  const saved = await call(
    appRouter.products.save,
    {
      title,
      status: 'draft',
      options: [{ name: 'Size', values: skus.map((_, i) => ({ value: `S${i}` })) }],
      variants: skus.map((sku, i) => ({
        optionValues: [`S${i}`],
        sku,
        pricePaise: 100_000,
        mrpPaise: 120_000,
        onHand: 5,
      })),
    },
    { context: ctx },
  )
  if (!saved) throw new Error('save')
  const sheet = await call(appRouter.products.bulkEditSheet, { ids: [saved.id] }, { context: ctx })
  return { productId: saved.id, sheet }
}

describe('products.bulkEdit', () => {
  it('loads a sheet, saves product, variant and stock cells together and can undo them', async () => {
    const a = await merchant('be-a@example.com', 'be-a')
    const { sheet } = await seedProduct(a.ctx, 'Pad', ['PAD-1', 'PAD-2'])
    expect(sheet.rows).toHaveLength(2)
    expect(sheet.locations.length).toBeGreaterThan(0)
    const loc = sheet.locations[0]?.id as string
    const [r1, r2] = sheet.rows

    const saved = await call(
      appRouter.products.bulkEdit,
      {
        rows: [
          {
            variantId: r1?.variantId as string,
            product: {
              title: 'Pad (new)',
              vendor: ' Acme ',
              tags: ['b', 'a', 'a'],
              status: 'active',
            },
            variant: { pricePaise: 90_000, hsCode: '9504', gstRatePercent: 18, sku: 'PAD-1X' },
            stock: { [loc]: 9 },
          },
          {
            variantId: r2?.variantId as string,
            product: {
              title: 'Pad (new)',
              vendor: 'Acme',
              tags: ['b', 'a', 'a'],
              status: 'active',
            },
            variant: { costPaise: 40_000, barcode: '' },
          },
        ],
      },
      { context: a.ctx },
    )
    expect(saved).toMatchObject({
      ok: true,
      updatedProducts: 1,
      updatedVariants: 2,
      stockChanges: 1,
    })

    const after = await call(
      appRouter.products.bulkEditSheet,
      { ids: [r1?.productId as string] },
      { context: a.ctx },
    )
    expect(after.rows[0]).toMatchObject({
      title: 'Pad (new)',
      status: 'active',
      vendor: 'Acme',
      tags: ['b', 'a'],
      pricePaise: 90_000,
      hsCode: '9504',
      gstRatePercent: 18,
      sku: 'PAD-1X',
      stock: { [loc]: 9 },
    })
    expect(after.rows[1]).toMatchObject({ costPaise: 40_000, barcode: null })
    const ledger = await owner
      .select()
      .from(inventoryAdjustment)
      .where(eq(inventoryAdjustment.variantId, r1?.variantId as string))
    expect(
      ledger.some((l) => l.delta === 4 && l.note === 'Bulk edit' && l.reason === 'correction'),
    ).toBe(true)

    if (!saved.ok) throw new Error('unreachable')
    const undone = await call(appRouter.products.bulkEdit, { rows: saved.undo }, { context: a.ctx })
    expect(undone).toMatchObject({ ok: true })
    const back = await call(
      appRouter.products.bulkEditSheet,
      { ids: [r1?.productId as string] },
      { context: a.ctx },
    )
    expect(back.rows[0]).toMatchObject({
      title: 'Pad',
      status: 'draft',
      vendor: null,
      pricePaise: 100_000,
      sku: 'PAD-1',
      stock: { [loc]: 5 },
    })
  })

  it('logs stock changes with the reason the Inventory page passed (#1033)', async () => {
    const a = await merchant('be-r@example.com', 'be-r')
    const { sheet } = await seedProduct(a.ctx, 'Restock', ['RS-1'])
    const loc = sheet.locations[0]?.id as string
    const variantId = sheet.rows[0]?.variantId as string
    const saved = await call(
      appRouter.products.bulkEdit,
      { rows: [{ variantId, stock: { [loc]: 40 } }], stockReason: 'received' },
      { context: a.ctx },
    )
    expect(saved).toMatchObject({ ok: true })
    const ledger = await owner
      .select()
      .from(inventoryAdjustment)
      .where(eq(inventoryAdjustment.variantId, variantId))
    expect(ledger.some((l) => l.reason === 'received' && l.note === 'Bulk edit')).toBe(true)
  })

  it('writes nothing and names every bad cell when any row is invalid', async () => {
    const a = await merchant('be-b@example.com', 'be-b')
    const { sheet } = await seedProduct(a.ctx, 'Mouse', ['M-1', 'M-2'])
    const [r1, r2] = sheet.rows
    const result = await call(
      appRouter.products.bulkEdit,
      {
        rows: [
          {
            variantId: r1?.variantId as string,
            product: { title: 'Changed' },
            variant: { pricePaise: 150_000, hsCode: 'abc', sku: 'DUP' },
            stock: { [crypto.randomUUID()]: 1 },
          },
          {
            variantId: r2?.variantId as string,
            product: { title: 'Different' },
            variant: { sku: 'dup' },
          },
          { variantId: crypto.randomUUID(), variant: { pricePaise: 1 } },
        ],
      },
      { context: a.ctx },
    )
    expect(result.ok).toBe(false)
    if (result.ok) throw new Error('unreachable')
    const fields = result.errors.map((e) => e.field).sort()
    expect(fields).toEqual(expect.arrayContaining(['mrpPaise', 'hsCode', 'sku', 'title', 'row']))
    expect(fields.some((f) => f.startsWith('stock:'))).toBe(true)

    const unchanged = await call(
      appRouter.products.bulkEditSheet,
      { ids: [r1?.productId as string] },
      { context: a.ctx },
    )
    expect(unchanged.rows[0]).toMatchObject({ title: 'Mouse', pricePaise: 100_000, sku: 'M-1' })
  })

  it('refuses a SKU already on another variant and never touches another store', async () => {
    const a = await merchant('be-c@example.com', 'be-c')
    const b = await merchant('be-d@example.com', 'be-d')
    const one = await seedProduct(a.ctx, 'One', ['TAKEN'])
    const two = await seedProduct(a.ctx, 'Two', ['FREE'])
    const other = await seedProduct(b.ctx, 'Other', ['B-1'])

    const clash = await call(
      appRouter.products.bulkEdit,
      { rows: [{ variantId: two.sheet.rows[0]?.variantId as string, variant: { sku: 'TAKEN' } }] },
      { context: a.ctx },
    )
    expect(clash).toMatchObject({ ok: false, errors: [{ field: 'sku' }] })
    expect(one.sheet.rows[0]?.sku).toBe('TAKEN')

    const foreign = await call(
      appRouter.products.bulkEdit,
      {
        rows: [{ variantId: other.sheet.rows[0]?.variantId as string, variant: { pricePaise: 1 } }],
      },
      { context: a.ctx },
    )
    expect(foreign).toMatchObject({
      ok: false,
      errors: [{ field: 'row', message: 'Variant not found' }],
    })
    const [untouched] = await owner
      .select()
      .from(variant)
      .where(eq(variant.id, other.sheet.rows[0]?.variantId as string))
    expect(untouched?.pricePaise).toBe(100_000)
  })

  it('rejects more rows than one sheet holds', async () => {
    const a = await merchant('be-e@example.com', 'be-e')
    const rows = Array.from({ length: 501 }, () => ({
      variantId: crypto.randomUUID(),
      variant: { pricePaise: 1 },
    }))
    await expect(
      call(appRouter.products.bulkEdit, { rows }, { context: a.ctx }),
    ).rejects.toBeTruthy()
  })
})

describe('products.removeVariants (bulk editor, #847)', () => {
  it("deletes picked variants but never a product's last one", async () => {
    const a = await merchant('rv-a@example.com', 'rv-a')
    const { productId, sheet } = await seedProduct(a.ctx, 'Pad', ['PAD-1', 'PAD-2', 'PAD-3'])
    const [r1, r2, r3] = sheet.rows.map((r) => r.variantId)

    const all = await call(
      appRouter.products.removeVariants,
      { ids: [r1, r2, r3] as string[] },
      { context: a.ctx },
    )
    expect(all).toEqual({ ok: false, blocked: [{ productId, title: 'Pad' }] })

    const two = await call(
      appRouter.products.removeVariants,
      { ids: [r1, r2] as string[] },
      { context: a.ctx },
    )
    expect(two).toEqual({ ok: true, removed: 2 })
    const left = await call(
      appRouter.products.bulkEditSheet,
      { ids: [productId] },
      { context: a.ctx },
    )
    expect(left.rows.map((r) => r.variantId)).toEqual([r3])
  })
})
