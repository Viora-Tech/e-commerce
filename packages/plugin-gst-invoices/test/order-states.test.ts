import {
  address,
  createDb,
  order,
  orderLine,
  orderNote,
  product,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import type { AppHookContext } from '@commerce/plugins'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { emailDocuments, emailedNote, invoicesToEmail } from '../src/email-documents'
import { gstOrderStates, invoiceStates } from '../src/order-states'
import { enqueueOrder, issueDrafts } from '../src/queue'
import { recordExternalInvoice } from '../src/record-external'
import { invoiceBatch } from '../src/schema'

/**
 * The order menus' invoice states (owner, 22 Nov 2026): Generate and Add to queue only while a
 * parcel has no live tax invoice, Email and Download once ours is issued, and a recorded
 * "Already invoiced" one counts as invoiced with no PDF. Plus the "Email invoice to customer" job.
 */

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const NOW = new Date('2026-11-18T06:00:00Z')

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

async function storeId(): Promise<string> {
  const [found] = await owner.select({ id: store.id }).from(store)
  if (found) return found.id
  const [s] = await owner
    .insert(store)
    .values({
      slug: 'waimers',
      name: 'Waimers',
      gstin: '06AAPFU0939F1ZZ',
      address: { line1: '14 Sector 29', city: 'Gurugram', state: 'HR', pincode: '122001' },
    })
    .returning()
  if (!s) throw new Error('seed')
  return s.id
}

async function seed(n: number, email: string | null = 'aarav@example.com') {
  const sid = await storeId()
  const [p] = await owner
    .insert(product)
    .values({ storeId: sid, handle: `kurta-${n}`, title: 'Kurta' })
    .returning()
  const [v] = await owner
    .insert(variant)
    .values({
      storeId: sid,
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
      storeId: sid,
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
      storeId: sid,
      number: n,
      status: 'open',
      paymentStatus: 'paid',
      checkoutPaidAt: new Date(),
      paymentMethod: 'razorpay',
      shippingAddressId: a?.id,
      subtotalPaise: 100_000,
      totalPaise: 100_000,
      email,
    })
    .returning()
  if (!o) throw new Error('seed')
  await owner.insert(orderLine).values({
    storeId: sid,
    orderId: o.id,
    variantId: v?.id as string,
    title: 'Kurta',
    variantTitle: 'M',
    quantity: 1,
    unitPricePaise: 100_000,
    gstRatePercent: 12,
    hsCode: '620520',
  })
  return { storeId: sid, orderId: o.id }
}

const inStore = <T>(sid: string, fn: Parameters<typeof withStore<T>>[2]) => withStore(app, sid, fn)

async function queue(sid: string, orderId: string) {
  const q = await inStore(sid, (tx) => enqueueOrder(tx, sid, orderId, 'manual', NOW))
  if (!q) throw new Error('not queued')
  return q.row.id
}

const issue = (sid: string, id: string) =>
  inStore(sid, (tx) => issueDrafts(tx, sid, [{ id, invoiceDate: NOW }], { commit: true, now: NOW }))

const recordOutside = (sid: string, id: string, number: string) =>
  inStore(sid, (tx) =>
    recordExternalInvoice(tx, sid, id, { number, invoiceDate: NOW }, { now: NOW }),
  )

const states = (sid: string, ids: string[]) =>
  inStore(sid, (tx) => gstOrderStates({ tx, storeId: sid }, ids))

describe('invoiceStates', () => {
  const ours = { status: 'issued', source: 'koomerce' } as const

  it('nothing issued: no state, so Generate and Add to queue show', () => {
    expect(invoiceStates([], 1)).toEqual([])
    expect(invoiceStates([{ ...ours, status: 'draft', fulfillmentOrderId: 'p1' }], 1)).toEqual([])
  })

  it('every parcel issued: invoiced, with a PDF', () => {
    expect(invoiceStates([{ ...ours, fulfillmentOrderId: null }], 0)).toEqual([
      'invoiced',
      'invoice-pdf',
    ])
    const two = [
      { ...ours, fulfillmentOrderId: 'p1' },
      { ...ours, fulfillmentOrderId: 'p2' },
    ]
    expect(invoiceStates(two, 2)).toEqual(['invoiced', 'invoice-pdf'])
  })

  it('one parcel of two issued, or the other still queued: not invoiced yet, has a PDF', () => {
    expect(invoiceStates([{ ...ours, fulfillmentOrderId: 'p1' }], 2)).toEqual(['invoice-pdf'])
    const queued = [
      { ...ours, fulfillmentOrderId: 'p1' },
      { ...ours, status: 'draft' as const, fulfillmentOrderId: 'p2' },
    ]
    expect(invoiceStates(queued, 2)).toEqual(['invoice-pdf'])
  })

  it('recorded outside Koomerce only: invoiced, no PDF', () => {
    expect(invoiceStates([{ ...ours, source: 'external', fulfillmentOrderId: null }], 1)).toEqual([
      'invoiced',
      'invoiced-outside',
    ])
  })
})

describe('gstOrderStates', () => {
  it('reads a page of orders: queued, issued here and recorded outside', async () => {
    const a = await seed(1)
    const b = await seed(2)
    const c = await seed(3)
    const sid = a.storeId
    await queue(sid, a.orderId)
    await issue(sid, await queue(sid, b.orderId))
    await recordOutside(sid, await queue(sid, c.orderId), 'VI/26-27/642')
    expect(await states(sid, [a.orderId, b.orderId, c.orderId])).toEqual({
      [b.orderId]: ['invoiced', 'invoice-pdf'],
      [c.orderId]: ['invoiced', 'invoiced-outside'],
    })
    expect(await states(sid, [])).toEqual({})
  })
})

describe('Email invoice to customer', () => {
  it('refuses an order with no invoice PDF or no email address', async () => {
    const a = await seed(1)
    const sid = a.storeId
    const toEmail = (orderId: string) => inStore(sid, (tx) => invoicesToEmail(tx, orderId))
    await expect(toEmail(a.orderId)).rejects.toThrow(/no invoice PDF/)
    await recordOutside(sid, await queue(sid, a.orderId), 'VI/26-27/1')
    await expect(toEmail(a.orderId)).rejects.toThrow(/outside Koomerce/)
    const b = await seed(2, null)
    await expect(toEmail(b.orderId)).rejects.toThrow(/no email address/)
  })

  it('emails the PDF, counts the batch and notes it on the timeline', async () => {
    const { storeId: sid, orderId } = await seed(1)
    await issue(sid, await queue(sid, orderId))
    const rows = await inStore(sid, (tx) => invoicesToEmail(tx, orderId))
    expect(rows).toHaveLength(1)
    const [batch] = await owner.insert(invoiceBatch).values({ storeId: sid, total: 1 }).returning()
    const files = new Map<string, Uint8Array>()
    const notify = vi.fn(async () => ({ sent: 1, errors: [] as string[] }))
    const ctx = {
      storeId: sid,
      inStore: <T>(fn: Parameters<typeof withStore<T>>[2]) => inStore(sid, fn),
      storage: async () => ({
        put: async (f: { key: string; body: Uint8Array }) => {
          files.set(f.key, f.body)
        },
        get: async (key: string) => files.get(key) ?? null,
      }),
      notify,
      log: () => undefined,
    } as unknown as AppHookContext
    await emailDocuments(ctx, {
      batchId: batch?.id,
      ids: rows.map((r) => r.id),
      author: 'owner@example.com',
    })
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ orderId, template: 'document_copy' }),
    )
    const [done] = await owner
      .select()
      .from(invoiceBatch)
      .where(eq(invoiceBatch.id, batch?.id as string))
    expect(done).toMatchObject({ sent: 1, failed: 0 })
    const notes = await owner.select().from(orderNote).where(eq(orderNote.orderId, orderId))
    expect(notes.map((n) => [n.body, n.author])).toContainEqual([
      emailedNote('tax_invoice', rows[0]?.number ?? null),
      'owner@example.com',
    ])
  })
})
