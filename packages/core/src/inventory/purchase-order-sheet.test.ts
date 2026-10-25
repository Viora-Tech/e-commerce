/** SOURCE OF TRUTH: tests for the purchase order PDF data and "Email to supplier" on real rows */
import {
  business,
  createDb,
  gstRegistration,
  location,
  newId,
  notification,
  product,
  purchaseOrder,
  type StoreTx,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import type { Message, NotificationChannel } from '@commerce/notifications'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { defaultLocationId } from './levels'
import { type PurchaseOrderSheet, poNumberLabel } from './po-sheet'
import { emailPurchaseOrder, loadPurchaseOrderSheet } from './purchase-order-sheet'
import { cancelPurchaseOrder, savePurchaseOrder } from './purchase-orders'
import type { PurchaseOrderInput } from './schemas'
import { saveSupplier } from './suppliers'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const PDF = new Uint8Array([37, 80, 68, 70])

/** A channel that records what it would send and answers `ok` (or fails with `error`). */
function recorder(
  id: string,
  opts: { requires?: 'email' | 'phone'; error?: string } = {},
): NotificationChannel & { sent: Message[] } {
  const sent: Message[] = []
  return {
    id,
    label: id,
    requires: opts.requires ?? 'email',
    sent,
    send: async (m) => {
      sent.push(m)
      return opts.error ? { ok: false, error: opts.error } : { ok: true, providerRef: `${id}-1` }
    },
  }
}

async function seed(opts: { gst?: boolean } = {}) {
  const [s] = await owner
    .insert(store)
    .values({
      slug: 'waimers',
      name: 'Waimers',
      gstin: '06AAAPL1234C1Z5',
      contactEmail: 'hello@waimers.example',
      contactPhone: '+91 98765 43210',
      address: {
        line1: 'Plot 4, Sector 18',
        line2: '',
        city: 'Gurugram',
        state: 'Haryana',
        pincode: '122015',
        country: 'IN',
      },
    })
    .returning()
  if (!s) throw new Error('seed')
  const loc = await withStore(app, s.id, (tx) => defaultLocationId(tx, s.id))
  let registrationId: string | null = null
  if (opts.gst) {
    const [b] = await owner
      .insert(business)
      .values({
        storeId: s.id,
        legalName: 'Waimers Retail Pvt Ltd',
        pan: 'AAAPL1234C',
        isPrimary: true,
      })
      .returning()
    const [r] = await owner
      .insert(gstRegistration)
      .values({
        storeId: s.id,
        businessId: b?.id as string,
        gstin: '07AAAPL1234C1Z3',
        isDefault: false,
        legalAddress: { line1: 'Okhla Phase 2', city: 'New Delhi', pincode: '110020' },
        email: 'gst@waimers.example',
      })
      .returning()
    registrationId = r?.id ?? null
  }
  await owner
    .update(location)
    .set({
      name: 'Delhi warehouse',
      line1: 'Shed 9, Okhla',
      city: 'New Delhi',
      stateCode: 'DL',
      pincode: '110020',
      phone: '+91 11 4000 0000',
      gstRegistrationId: registrationId,
    })
    .where(eq(location.id, loc))
  const productId = newId()
  await owner
    .insert(product)
    .values({ id: productId, storeId: s.id, title: 'Wireless pad', handle: 'pad' })
  const addVariant = async (title: string, sku: string | null) => {
    const id = newId()
    await owner
      .insert(variant)
      .values({ id, storeId: s.id, productId, title, sku, pricePaise: 500_000 })
    return id
  }
  const black = await addVariant('Black', 'WP-BLK')
  const single = await addVariant('Default', null)
  return { storeId: s.id, loc, black, single }
}

type Ctx = Awaited<ReturnType<typeof seed>>

const run = <T>(c: Ctx, fn: (tx: StoreTx) => Promise<T>) => withStore(app, c.storeId, fn)

const draft = (c: Ctx, over: Partial<PurchaseOrderInput> = {}) =>
  run(c, (tx) =>
    savePurchaseOrder(tx, c.storeId, {
      supplierName: 'Shenzhen Pads',
      locationId: c.loc,
      currency: 'USD',
      fxRate: '83.5',
      lines: [
        { variantId: c.black, quantity: 100, unitPriceMinor: 840, hsnCode: '85044030' },
        { variantId: c.single, quantity: 200, unitPriceMinor: 200 },
      ],
      ...over,
    }),
  )

const sheetOf = (c: Ctx, id: string) => run(c, (tx) => loadPurchaseOrderSheet(tx, c.storeId, id))

const statusOf = async (id: string) =>
  (await owner.select().from(purchaseOrder).where(eq(purchaseOrder.id, id)))[0]

const email = (
  c: Ctx,
  id: string,
  channels: NotificationChannel[],
  over: { to?: string; message?: string; markOrdered?: boolean } = {},
) => {
  const rendered: PurchaseOrderSheet[] = []
  const result = run(c, (tx) =>
    emailPurchaseOrder(
      tx,
      c.storeId,
      {
        id,
        to: over.to ?? 'Sales@Pads.example',
        message: over.message,
        markOrdered: over.markOrdered,
      },
      {
        channels,
        renderPdf: async (sheet) => {
          rendered.push(sheet)
          return PDF
        },
      },
    ),
  )
  return { result, rendered }
}

describe('loadPurchaseOrderSheet', () => {
  it('prints lines in the order currency, the store as buyer and the location as ship-to', async () => {
    const c = await seed()
    const supplierId = await run(c, (tx) =>
      saveSupplier(tx, c.storeId, {
        name: 'Shenzhen Pads',
        gstin: '',
        country: 'CN',
        currency: 'USD',
        email: 'sales@pads.example',
        phone: '+86 755 0000',
        address: 'Bao’an District\nShenzhen 518000',
        paymentTerms: '30% advance, rest before dispatch',
      }),
    )
    const id = await draft(c, {
      supplierId,
      expectedAt: new Date('2026-11-14T20:00:00Z'),
      note: 'Pack sleeves separately',
    })
    const sheet = await sheetOf(c, id)
    expect(sheet.number).toBe(1)
    expect(poNumberLabel(sheet.number)).toBe('PO1')
    expect(sheet.status).toBe('draft')
    expect(sheet.currency).toBe('USD')
    // 20:00 UTC on 14 Nov is 15 Nov in India.
    expect(sheet.expectedLabel).toBe('15 Nov 2026')
    expect(sheet.lines).toEqual([
      {
        variantId: c.black,
        title: 'Wireless pad / Black',
        sku: 'WP-BLK',
        hsnCode: '85044030',
        quantity: 100,
        unitPriceMinor: 840,
        totalMinor: 84_000,
      },
      {
        variantId: c.single,
        title: 'Wireless pad',
        sku: null,
        hsnCode: null,
        quantity: 200,
        unitPriceMinor: 200,
        totalMinor: 40_000,
      },
    ])
    expect(sheet.units).toBe(300)
    expect(sheet.totalMinor).toBe(124_000)
    expect(sheet.buyer).toEqual({
      name: 'Waimers',
      gstin: '06AAAPL1234C1Z5',
      address: ['Plot 4, Sector 18', 'Gurugram, Haryana, 122015'],
      email: 'hello@waimers.example',
      phone: '+91 98765 43210',
    })
    expect(sheet.shipTo).toEqual({
      name: 'Delhi warehouse',
      gstin: null,
      address: ['Shed 9, Okhla', 'New Delhi, Delhi, 110020'],
      email: null,
      phone: '+91 11 4000 0000',
    })
    expect(sheet.supplier).toEqual({
      name: 'Shenzhen Pads',
      gstin: null,
      address: ['Bao’an District', 'Shenzhen 518000'],
      email: 'sales@pads.example',
      phone: '+86 755 0000',
    })
    expect(sheet.paymentTerms).toBe('30% advance, rest before dispatch')
    expect(sheet.note).toBe('Pack sleeves separately')
  })

  it('bills to the GST registration the destination receives under', async () => {
    const c = await seed({ gst: true })
    const sheet = await sheetOf(c, await draft(c))
    expect(sheet.buyer).toEqual({
      name: 'Waimers Retail Pvt Ltd',
      gstin: '07AAAPL1234C1Z3',
      address: ['Okhla Phase 2', 'New Delhi, Delhi, 110020'],
      email: 'gst@waimers.example',
      phone: '+91 98765 43210',
    })
  })

  it('dates an ordered purchase order by its order day and leaves out a missing arrival date', async () => {
    const c = await seed()
    const id = await draft(c, { markOrdered: true })
    const sheet = await sheetOf(c, id)
    expect(sheet.status).toBe('ordered')
    expect(sheet.expectedLabel).toBeNull()
    expect(sheet.dateLabel).toMatch(/^\d{1,2} [A-Z][a-z]{2} \d{4}$/)
    expect(sheet.supplier.email).toBeNull()
    expect(sheet.paymentTerms).toBeNull()
  })

  it('cannot read another store’s purchase order', async () => {
    const c = await seed()
    const id = await draft(c)
    const [other] = await owner.insert(store).values({ slug: 'other', name: 'Other' }).returning()
    await expect(
      withStore(app, other?.id as string, (tx) =>
        loadPurchaseOrderSheet(tx, other?.id as string, id),
      ),
    ).rejects.toThrow('Purchase order not found')
  })
})

describe('emailPurchaseOrder', () => {
  it('sends the PDF once through the first email channel and logs it', async () => {
    const c = await seed()
    const id = await draft(c, { expectedAt: new Date('2026-11-15T06:00:00Z') })
    const phone = recorder('whatsapp', { requires: 'phone' })
    const first = recorder('platform')
    const second = recorder('resend')
    const { result, rendered } = email(c, id, [phone, first, second], {
      message: 'Please pack the sleeves separately.',
    })
    expect(await result).toEqual({
      to: 'sales@pads.example',
      channel: 'platform',
      markedOrdered: false,
    })
    expect(phone.sent).toHaveLength(0)
    expect(second.sent).toHaveLength(0)
    expect(first.sent).toHaveLength(1)
    const m = first.sent[0] as Message
    expect(m.template).toBe('purchase_order')
    expect(m.to).toEqual({ email: 'sales@pads.example', name: 'Shenzhen Pads' })
    expect(m.attachments).toEqual([
      { filename: 'purchase-order-PO1.pdf', contentType: 'application/pdf', content: PDF },
    ])
    expect(m.data.storeName).toBe('Waimers')
    expect(m.data.totalLabel).toBe('USD 1,240.00')
    expect(m.data.lines).toEqual([
      { title: 'Wireless pad / Black', quantity: 100, priceLabel: 'USD 840.00' },
      { title: 'Wireless pad', quantity: 200, priceLabel: 'USD 400.00' },
    ])
    expect(m.data.purchaseOrder).toEqual({
      numberLabel: 'PO1',
      supplierName: 'Shenzhen Pads',
      expectedLabel: '15 Nov 2026',
      message: 'Please pack the sleeves separately.',
    })
    expect(rendered).toHaveLength(1)
    const logged = await owner.select().from(notification)
    expect(logged).toEqual([
      expect.objectContaining({
        storeId: c.storeId,
        orderId: null,
        channel: 'platform',
        template: 'purchase_order',
        to: 'sales@pads.example',
        status: 'sent',
        providerRef: 'platform-1',
      }),
    ])
    // Sending alone leaves a draft a draft, and saves the address it went to.
    const po = await statusOf(id)
    expect(po?.status).toBe('draft')
    expect(po?.supplierEmail).toBe('sales@pads.example')
  })

  it('marks a draft ordered first so the PDF carries the order, when asked', async () => {
    const c = await seed()
    const id = await draft(c)
    const ch = recorder('platform')
    const { result, rendered } = email(c, id, [ch], { markOrdered: true })
    expect((await result).markedOrdered).toBe(true)
    expect(rendered[0]?.status).toBe('ordered')
    expect((await statusOf(id))?.status).toBe('ordered')
    expect(ch.sent[0]?.data.purchaseOrder?.message).toBeUndefined()
  })

  it('ignores mark-as-ordered on an order already placed, and keeps its saved email', async () => {
    const c = await seed()
    const id = await draft(c, { markOrdered: true, supplierEmail: 'orders@pads.example' })
    const ch = recorder('platform')
    const { result } = email(c, id, [ch], { to: 'boss@pads.example', markOrdered: true })
    expect(await result).toEqual({
      to: 'boss@pads.example',
      channel: 'platform',
      markedOrdered: false,
    })
    const po = await statusOf(id)
    expect(po?.status).toBe('ordered')
    expect(po?.supplierEmail).toBe('orders@pads.example')
  })

  it('falls through a failing channel to the next and logs both tries', async () => {
    const c = await seed()
    const id = await draft(c)
    const broken = recorder('platform', { error: 'SES throttled' })
    const backup = recorder('resend')
    const { result } = email(c, id, [broken, backup])
    expect((await result).channel).toBe('resend')
    const logged = await owner.select().from(notification)
    expect(logged.map((n) => [n.channel, n.status, n.error])).toEqual(
      expect.arrayContaining([
        ['platform', 'failed', 'SES throttled'],
        ['resend', 'sent', null],
      ]),
    )
  })

  it('refuses the whole step when no channel takes it: the draft stays a draft', async () => {
    const c = await seed()
    const id = await draft(c)
    const { result } = email(
      c,
      id,
      [recorder('platform', { error: 'sandbox: address not verified' })],
      {
        markOrdered: true,
      },
    )
    await expect(result).rejects.toThrow('The email did not go: sandbox: address not verified')
    const po = await statusOf(id)
    expect(po?.status).toBe('draft')
    expect(po?.supplierEmail).toBeNull()
  })

  it('says how to fix it when the store has no email channel', async () => {
    const c = await seed()
    const id = await draft(c)
    const { result } = email(c, id, [recorder('whatsapp', { requires: 'phone' })])
    await expect(result).rejects.toThrow('No email is set up for this store yet')
  })

  it('will not send a cancelled order or an empty draft', async () => {
    const c = await seed()
    const cancelled = await draft(c)
    await run(c, (tx) => cancelPurchaseOrder(tx, c.storeId, cancelled))
    await expect(email(c, cancelled, [recorder('platform')]).result).rejects.toThrow(
      'A cancelled purchase order cannot be sent',
    )
    const empty = await draft(c, { lines: [] })
    await expect(email(c, empty, [recorder('platform')]).result).rejects.toThrow(
      'Add at least one product first',
    )
    expect(await owner.select().from(notification)).toHaveLength(0)
  })

  it('cannot email another store’s purchase order', async () => {
    const c = await seed()
    const id = await draft(c)
    const [other] = await owner.insert(store).values({ slug: 'other', name: 'Other' }).returning()
    const ch = recorder('platform')
    await expect(
      withStore(app, other?.id as string, (tx) =>
        emailPurchaseOrder(
          tx,
          other?.id as string,
          { id, to: 'x@y.example' },
          { channels: [ch], renderPdf: async () => PDF },
        ),
      ),
    ).rejects.toThrow('Purchase order not found')
    expect(ch.sent).toHaveLength(0)
  })

  it('rejects a bad address before doing anything', async () => {
    const c = await seed()
    const id = await draft(c)
    await expect(
      email(c, id, [recorder('platform')], { to: 'not-an-email' }).result,
    ).rejects.toThrow()
    expect((await statusOf(id))?.supplierEmail).toBeNull()
  })
})
