import { createMerchantAuth } from '@commerce/auth'
import { gstinCheckChar } from '@commerce/core/gstin'
import {
  address,
  createDb,
  order,
  orderLine,
  orderNote,
  product,
  role,
  rolePermission,
  store,
  storeMember,
  variant,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { invoice, invoiceVersion } from '@commerce/plugin-gst-invoices/schema'
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

/** A paid order of `quantity` kurtas (two by default) (12%, HSN 620520) delivered to Mumbai: inter-state from Haryana. */
async function seedOrder(
  storeId: string,
  n: number,
  buyer: { gstin?: string; business?: string } = {},
  quantity = 2,
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
      subtotalPaise: quantity * 100_000,
      shippingPaise: 0,
      totalPaise: quantity * 100_000,
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
    quantity,
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

async function issued(m: Awaited<ReturnType<typeof merchant>>, n: number, quantity = 2) {
  const orderId = await seedOrder(m.storeId, n, {}, quantity)
  await call(appRouter.gstInvoices.generate, { orderId }, { context: m.ctx })
  const [row] = await owner.select().from(invoice).where(eq(invoice.orderId, orderId))
  return { orderId, row: row as typeof invoice.$inferSelect }
}

describe('Edit an issued GST invoice', () => {
  it('retaxes in place, keeps the number, writes a version and GSTR-1 reads the latest', async () => {
    const m = await merchant('a@example.com', 'store-a')
    const { orderId, row } = await issued(m, 1)
    const start = await call(appRouter.gstInvoices.getEdit, { id: row.id }, { context: m.ctx })
    expect(start.lock).toMatchObject({ editable: true, reason: null })
    expect(start.versions).toEqual([])

    const form = structuredClone(start.form)
    form.lines[0] = { quantity: 1, unitPricePaise: 100_000, discountPaise: 0 }
    const saved = await call(
      appRouter.gstInvoices.saveEdit,
      { id: row.id, edit: form, reason: 'Shipped one' },
      { context: m.ctx },
    )
    expect(saved).toMatchObject({ number: row.number, version: 1 })

    const [after] = await owner.select().from(invoice).where(eq(invoice.id, row.id))
    expect(after?.number).toBe(row.number)
    expect(after?.invoiceDate?.toISOString()).toBe(row.invoiceDate?.toISOString())
    expect(after).toMatchObject({ totalPaise: 100_000, status: 'issued', pdfStatus: 'ready' })

    // The same values issued fresh carry the same tax.
    const fresh = await issued(m, 2, 1)
    expect(after).toMatchObject({
      taxablePaise: fresh.row.taxablePaise,
      igstPaise: fresh.row.igstPaise,
      totalPaise: fresh.row.totalPaise,
    })

    const versions = await owner
      .select()
      .from(invoiceVersion)
      .where(eq(invoiceVersion.invoiceId, row.id))
    expect(versions).toHaveLength(1)
    expect(versions[0]).toMatchObject({
      version: 1,
      reason: 'Shipped one',
      createdBy: 'a@example.com',
    })
    expect(versions[0]?.snapshot).toMatchObject({ totals: { totalPaise: 200_000 } })
    const notes = await owner.select().from(orderNote).where(eq(orderNote.orderId, orderId))
    expect(notes.map((n) => n.body).join(' | ')).toContain('edited (edit 1)')

    const history = await call(appRouter.gstInvoices.getEdit, { id: row.id }, { context: m.ctx })
    expect(history.versions).toMatchObject([{ version: 1, changes: expect.any(Array) }])
    expect(history.form.lines[0]?.quantity).toBe(1)

    const s = await call(
      appRouter.gstInvoices.returns.summary,
      { period: periodOf(new Date()) },
      { context: m.ctx },
    )
    // Two invoices of one kurta each now: ₹2,000 in all, not ₹3,000.
    expect(s.totals.find((t) => t.table === 'b2cs')).toMatchObject({
      taxablePaise: 2 * (fresh.row.taxablePaise as number),
    })

    const pdf = await call(
      appRouter.gstInvoices.getVersionPdf,
      { id: row.id, version: 1 },
      { context: m.ctx },
    )
    expect(new TextDecoder().decode((await pdf.arrayBuffer()).slice(0, 5))).toBe('%PDF-')
  })

  it('is refused once the month is marked filed, or the invoice is cancelled', async () => {
    const m = await merchant('b@example.com', 'store-b')
    const a = await issued(m, 1)
    const b = await issued(m, 2)
    const { form } = await call(appRouter.gstInvoices.getEdit, { id: b.row.id }, { context: m.ctx })
    form.lines[0] = { quantity: 1, unitPricePaise: 100_000, discountPaise: 0 }
    await call(
      appRouter.gstInvoices.cancel,
      { id: b.row.id, reason: 'Wrong buyer' },
      { context: m.ctx },
    )
    await expect(
      call(appRouter.gstInvoices.saveEdit, { id: b.row.id, edit: form }, { context: m.ctx }),
    ).rejects.toThrow(/cancelled/)

    await call(
      appRouter.gstInvoices.periods.setFiled,
      { period: periodOf(new Date()), filed: true },
      { context: m.ctx },
    )
    const locked = await call(appRouter.gstInvoices.getEdit, { id: a.row.id }, { context: m.ctx })
    expect(locked.lock).toMatchObject({ editable: false, reason: 'filed' })
    await expect(
      call(appRouter.gstInvoices.saveEdit, { id: a.row.id, edit: form }, { context: m.ctx }),
    ).rejects.toThrow(/marked filed/)
  })

  it('needs orders write permission to save', async () => {
    const m = await merchant('c@example.com', 'store-c')
    const { row } = await issued(m, 1)
    const { form } = await call(appRouter.gstInvoices.getEdit, { id: row.id }, { context: m.ctx })
    const [viewer] = await owner
      .insert(role)
      .values({ storeId: m.storeId, name: 'Viewer', slug: 'viewer' })
      .returning()
    await owner
      .insert(rolePermission)
      .values({ storeId: m.storeId, roleId: viewer?.id as string, permission: 'orders.read' })
    await owner
      .update(storeMember)
      .set({ roleId: viewer?.id as string })
      .where(eq(storeMember.storeId, m.storeId))
    await call(appRouter.gstInvoices.getEdit, { id: row.id }, { context: m.ctx })
    form.lines[0] = { quantity: 1, unitPricePaise: 100_000, discountPaise: 0 }
    await expect(
      call(appRouter.gstInvoices.saveEdit, { id: row.id, edit: form }, { context: m.ctx }),
    ).rejects.toThrow()
    const versions = await owner
      .select()
      .from(invoiceVersion)
      .where(eq(invoiceVersion.invoiceId, row.id))
    expect(versions).toEqual([])
  })
})
