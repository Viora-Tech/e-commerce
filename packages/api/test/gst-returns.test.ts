import { createMerchantAuth } from '@commerce/auth'
import { gstinCheckChar } from '@commerce/core/gstin'
import {
  address,
  createDb,
  order,
  orderLine,
  product,
  role,
  rolePermission,
  store,
  storeMember,
  variant,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import type { Gstr1Json } from '@commerce/invoices'
import { invoice } from '@commerce/plugin-gst-invoices/schema'
import { periodOf } from '@commerce/plugin-gst-invoices/server'
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

const valid = (first14: string) => first14 + gstinCheckChar(first14)
/** The store's own GSTIN, in Haryana (06). */
const SELLER = valid('06AAPFU0939F1Z')
/** A registered buyer in Maharashtra (27). */
const BUYER = valid('27AAPFU0939F1Z')

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
      name: 'Waimers',
      organizationId: org?.id as string,
      gstin: SELLER,
      address: { line1: '14 Sector 29', city: 'Gurugram', state: 'HR', pincode: '122001' },
      apps: { installed: ['gst-invoices'] },
    })
    .returning()
  return {
    ctx: { db: app, auth, headers, notifications: { add: async () => undefined } } as ApiContext,
    storeId: s?.id as string,
  }
}

/** A paid order of two kurtas (12%, HSN 620520) delivered to Mumbai: inter-state from Haryana. */
async function seedOrder(
  storeId: string,
  n: number,
  buyer: { gstin?: string; business?: string } = {},
) {
  const [p] = await owner
    .insert(product)
    .values({ storeId, handle: `kurta-${n}`, title: 'Kurta' })
    .returning()
  const [v] = await owner
    .insert(variant)
    .values({
      storeId,
      productId: p?.id as string,
      title: 'M',
      sku: `KRT-${n}`,
      hsCode: '620520',
      pricePaise: 100_000,
    })
    .returning()
  const [a] = await owner
    .insert(address)
    .values({
      storeId,
      name: 'Aarav Mehta',
      line1: 'Carter Road',
      city: 'Mumbai',
      stateCode: 'MH',
      pincode: '400050',
      country: 'IN',
      phone: '9820012345',
    })
    .returning()
  const [o] = await owner
    .insert(order)
    .values({
      storeId,
      number: n,
      status: 'open',
      paymentStatus: 'paid',
      checkoutPaidAt: new Date(),
      paymentMethod: 'razorpay',
      shippingAddressId: a?.id,
      subtotalPaise: 200_000,
      shippingPaise: 0,
      totalPaise: 200_000,
      email: 'aarav@example.com',
      buyerGstin: buyer.gstin ?? null,
      buyerBusinessName: buyer.business ?? null,
    })
    .returning()
  await owner.insert(orderLine).values({
    storeId,
    orderId: o?.id as string,
    variantId: v?.id as string,
    title: 'Kurta',
    variantTitle: 'M',
    quantity: 2,
    unitPricePaise: 100_000,
    gstRatePercent: 12,
    hsCode: '620520',
  })
  return o?.id as string
}

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('GST returns', () => {
  it('builds the month from issued invoices: GSTR-1 JSON, totals, 3B and warnings', async () => {
    const m = await merchant('a@example.com', 'store-a')
    const consumer = await seedOrder(m.storeId, 1)
    const business = await seedOrder(m.storeId, 2, { gstin: BUYER, business: 'Mehta Traders' })
    const noGstin = await seedOrder(m.storeId, 3, { business: 'Acme Studio' })
    for (const orderId of [consumer, business, noGstin]) {
      await call(appRouter.gstInvoices.generate, { orderId }, { context: m.ctx })
    }
    const period = periodOf(new Date())

    const s = await call(appRouter.gstInvoices.returns.summary, { period }, { context: m.ctx })
    expect(s.gstin).toBe(SELLER)
    // ₹2,000 at 12% inclusive: taxable 1,785.71, IGST 214.29 each (Haryana → Maharashtra).
    expect(s.totals.find((t) => t.table === 'b2b')).toMatchObject({
      documents: 1,
      taxablePaise: 1_785_71,
      igstPaise: 214_29,
    })
    expect(s.totals.find((t) => t.table === 'b2cs')).toMatchObject({
      documents: 1,
      taxablePaise: 3_571_42,
      igstPaise: 428_58,
    })
    expect(s.gstr3b.outwardTaxable).toMatchObject({ taxablePaise: 5_357_13, igstPaise: 642_87 })
    expect(s.gstr3b.unregisteredInterState).toEqual([
      { pos: '27', name: 'Maharashtra', taxablePaise: 3_571_42, igstPaise: 428_58 },
    ])
    expect(s.documents).toEqual([
      { doc_num: 1, docs: [expect.objectContaining({ totnum: 3, cancel: 0, net_issue: 3 })] },
    ])
    expect(s.warnings.map((w) => w.code)).toEqual(['business_without_gstin'])

    const file = await call(appRouter.gstInvoices.returns.gstr1Json, { period }, { context: m.ctx })
    expect(file.name).toBe(`GSTR1_${SELLER}_${period.slice(5)}${period.slice(0, 4)}.json`)
    const json = JSON.parse(await file.text()) as Gstr1Json
    expect(json.fp).toBe(`${period.slice(5)}${period.slice(0, 4)}`)
    expect(json.b2b?.[0]?.ctin).toBe(BUYER)
    expect(json.b2cs).toEqual([
      expect.objectContaining({ sply_ty: 'INTER', pos: '27', rt: 12, txval: 3571.42 }),
    ])
    expect(json.hsn.hsn_b2b).toEqual([expect.objectContaining({ hsn_sc: '6205', qty: 2 })])
    expect(json.hsn.hsn_b2c).toEqual([expect.objectContaining({ hsn_sc: '6205', qty: 4 })])

    const csv = await call(
      appRouter.gstInvoices.returns.gstr3b,
      { period, format: 'csv' },
      { context: m.ctx },
    )
    expect(await csv.text()).toContain(',27-Maharashtra,3571.42,428.58')
    const pdf = await call(
      appRouter.gstInvoices.returns.gstr3b,
      { period, format: 'pdf' },
      { context: m.ctx },
    )
    expect(new TextDecoder().decode((await pdf.arrayBuffer()).slice(0, 5))).toBe('%PDF-')
    const summaryCsv = await call(
      appRouter.gstInvoices.returns.gstr1Csv,
      { period },
      { context: m.ctx },
    )
    expect(await summaryCsv.text()).toContain('b2b,1,1785.71,214.29,0.00,0.00,0.00')
  })

  it('lists a cancelled invoice in Table 13 and warns about it', async () => {
    const m = await merchant('b@example.com', 'store-b')
    const orderId = await seedOrder(m.storeId, 1)
    await call(appRouter.gstInvoices.generate, { orderId }, { context: m.ctx })
    const [row] = await owner.select().from(invoice).where(eq(invoice.orderId, orderId))
    await call(
      appRouter.gstInvoices.cancel,
      { id: row?.id as string, reason: 'Wrong buyer' },
      { context: m.ctx },
    )
    const s = await call(
      appRouter.gstInvoices.returns.summary,
      { period: periodOf(new Date()) },
      { context: m.ctx },
    )
    expect(s.totals).toEqual([])
    expect(s.documents[0]?.docs[0]).toMatchObject({ totnum: 1, cancel: 1, net_issue: 0 })
    expect(s.warnings).toEqual([{ code: 'cancelled', numbers: [row?.number] }])
  })

  it('needs orders read permission and the app installed', async () => {
    const m = await merchant('c@example.com', 'store-c')
    const period = periodOf(new Date())
    // First call seeds the system roles and the owner's membership.
    await call(appRouter.gstInvoices.returns.summary, { period }, { context: m.ctx })
    const [catalog] = await owner
      .insert(role)
      .values({ storeId: m.storeId, name: 'Catalog', slug: 'catalog' })
      .returning()
    await owner
      .insert(rolePermission)
      .values({ storeId: m.storeId, roleId: catalog?.id as string, permission: 'products.read' })
    await owner
      .update(storeMember)
      .set({ roleId: catalog?.id as string })
      .where(eq(storeMember.storeId, m.storeId))
    await expect(
      call(appRouter.gstInvoices.returns.summary, { period }, { context: m.ctx }),
    ).rejects.toThrow()

    const n = await merchant('d@example.com', 'store-d')
    await owner
      .update(store)
      .set({ apps: { installed: [] } })
      .where(eq(store.id, n.storeId))
    await expect(
      call(appRouter.gstInvoices.returns.summary, { period }, { context: n.ctx }),
    ).rejects.toThrow(/Install the GST invoices app/)
  })
})
