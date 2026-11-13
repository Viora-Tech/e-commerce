import { createMerchantAuth } from '@commerce/auth'
import { storeShippingLabel } from '@commerce/core'
import { createDb, order, shipment, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { call } from '@orpc/server'
import { eq } from 'drizzle-orm'
import { PDFDocument } from 'pdf-lib'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { ApiContext } from '../src/context'
import { appRouter } from '../src/routers/_app'

/**
 * "Print N labels" as one file (Figma 909:9249): the batch's labels merged into one PDF in the
 * merchant's paper, scoped to the caller's store, with labels that cannot be printed named.
 * Labels come from the store's private storage here, so no courier is ever called.
 */

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

/** A small generated label PDF of one page. */
async function labelPdf(width = 288, height = 432): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.addPage([width, height]).drawText('AWB', { x: 10, y: 10, size: 8 })
  return doc.save()
}

/** A booked shipment on a new order; `label` keeps a label file for it in private storage. */
async function booked(
  storeId: string,
  number: number,
  opts: { label?: Uint8Array; status?: 'created' | 'cancelled'; noLabel?: boolean } = {},
) {
  const [o] = await owner
    .insert(order)
    .values({ storeId, number, status: 'open', subtotalPaise: 1000, totalPaise: 1000 })
    .returning()
  const [s] = await owner
    .insert(shipment)
    .values({
      storeId,
      orderId: o?.id as string,
      provider: 'bluedart',
      waybill: `BD${number}`,
      status: opts.status ?? 'created',
    })
    .returning()
  const id = s?.id as string
  if (opts.label) {
    const url = await withStore(app, storeId, (tx) =>
      storeShippingLabel({ storeId, tx }, id, {
        contentType: 'application/pdf',
        body: opts.label as Uint8Array,
      }),
    )
    await owner.update(shipment).set({ labelUrl: url }).where(eq(shipment.id, id))
  } else if (!opts.noLabel) {
    // Points at the stored-label route, but nothing was kept (storage failed at booking).
    await owner
      .update(shipment)
      .set({ labelUrl: `/api/shipments/${id}/label` })
      .where(eq(shipment.id, id))
  }
  return id
}

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('shipments.labelSheet', () => {
  it("merges the store's labels into one 4 × 6 file and names those it skipped", async () => {
    const a = await merchant('labels-a@example.com', 'labels-a')
    const b = await merchant('labels-b@example.com', 'labels-b')
    const one = await booked(a.storeId, 101, { label: await labelPdf() })
    const two = await booked(a.storeId, 102, { label: await labelPdf(595, 842) })
    const waiting = await booked(a.storeId, 103, { noLabel: true })
    const cancelled = await booked(a.storeId, 104, {
      label: await labelPdf(),
      status: 'cancelled',
    })
    const lost = await booked(a.storeId, 105)
    const other = await booked(b.storeId, 201, { label: await labelPdf() })

    const res = await call(
      appRouter.shipments.labelSheet,
      { ids: [one, waiting, two, cancelled, lost, other], format: 'thermal4x6' },
      { context: a.ctx },
    )
    expect(res.printed).toBe(2)
    expect(res.file?.name).toMatch(/^labels-\d{4}-\d{2}-\d{2}\.pdf$/)
    const doc = await PDFDocument.load(new Uint8Array(await (res.file as File).arrayBuffer()))
    expect(
      doc.getPages().map((p) => [Math.round(p.getWidth()), Math.round(p.getHeight())]),
    ).toEqual([
      [288, 432],
      [288, 432],
    ])
    expect(res.skipped).toEqual([
      { shipmentId: waiting, orderNumber: 103, reason: 'no_label' },
      { shipmentId: cancelled, orderNumber: 104, reason: 'cancelled' },
      { shipmentId: lost, orderNumber: 105, reason: 'no_label' },
      // Another store's shipment is never read: not found, and no order number leaks.
      { shipmentId: other, orderNumber: null, reason: 'not_found' },
    ])
  })

  it('puts four labels on an A4 sheet', async () => {
    const a = await merchant('labels-a4@example.com', 'labels-a4')
    const ids: string[] = []
    for (let n = 1; n <= 5; n++) ids.push(await booked(a.storeId, n, { label: await labelPdf() }))
    const res = await call(
      appRouter.shipments.labelSheet,
      { ids, format: 'a4x4' },
      { context: a.ctx },
    )
    expect(res.printed).toBe(5)
    const doc = await PDFDocument.load(new Uint8Array(await (res.file as File).arrayBuffer()))
    expect(doc.getPageCount()).toBe(2)
  })

  it('returns no file when none of the labels is available yet', async () => {
    const a = await merchant('labels-none@example.com', 'labels-none')
    const id = await booked(a.storeId, 9, { noLabel: true })
    const res = await call(
      appRouter.shipments.labelSheet,
      { ids: [id], format: 'original' },
      { context: a.ctx },
    )
    expect(res).toMatchObject({ file: null, printed: 0 })
    expect(res.skipped).toEqual([{ shipmentId: id, orderNumber: 9, reason: 'no_label' }])
  })

  it('refuses more than 100 labels at once', async () => {
    const a = await merchant('labels-cap@example.com', 'labels-cap')
    const ids = Array.from({ length: 101 }, () => crypto.randomUUID())
    await expect(
      call(appRouter.shipments.labelSheet, { ids, format: 'thermal4x6' }, { context: a.ctx }),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })
})
