/** SOURCE OF TRUTH: tests for staff cancel, taking over an imported order, and order editing — WHAT: cancel with restock/refund choices (native and imported), takeover stock, edit add/remove/quantity with the balance going up and down / WHY: issues 801 and 802 */
import {
  address,
  createDb,
  fulfillmentOrder,
  fulfillmentOrderLine,
  giftCard,
  inventoryLevel,
  order,
  orderLine,
  orderNote,
  outboxEvent,
  payment,
  product,
  refund,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { OutOfStock } from '../errors'
import { FakePaymentProvider } from '../providers/payment'
import { convertDraft, createDraft } from './drafts'
import { duplicateOrderAsDraft } from './duplicate'
import { editOrder, previewOrderEdit } from './edit'
import { OrderEditRefused, OrderEditSchema } from './edit-plan'
import { ORDER_EDIT_REFUND_REASON } from './edit-settle'
import { recomputeOrderStatuses } from './recompute'
import { RefundNotAllowed } from './refund'
import { cancelOrderByStaff } from './staff-cancel'
import { takeOverImportedOrder } from './takeover'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

const STAFF = 'owner@waimers.in'
const gateway = () => new FakePaymentProvider()

async function seed() {
  const [s] = await owner.insert(store).values({ slug: 'w', name: 'Waimers' }).returning()
  if (!s) throw new Error('seed')
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'pad', title: 'Glasspad', status: 'active' })
    .returning()
  const [v] = await owner
    .insert(variant)
    .values({ storeId: s.id, productId: p?.id as string, title: 'Black', pricePaise: 100000 })
    .returning()
  const [v2] = await owner
    .insert(variant)
    .values({ storeId: s.id, productId: p?.id as string, title: 'White', pricePaise: 50000 })
    .returning()
  if (!v || !v2) throw new Error('seed')
  await owner.insert(inventoryLevel).values([
    { storeId: s.id, variantId: v.id, onHand: 10 },
    { storeId: s.id, variantId: v2.id, onHand: 4 },
  ])
  return { storeId: s.id, black: v.id, white: v2.id }
}

const shipping = {
  name: 'Raj',
  line1: '1B Main Road',
  city: 'Bengaluru',
  stateCode: 'KA',
  pincode: '560037',
  phone: '9777922152',
}

/** An open order for 2 × Black, placed like a converted draft, and paid through `fake` when asked. */
async function placed(storeId: string, black: string, opts: { paid: boolean } = { paid: true }) {
  return withStore(app, storeId, async (tx) => {
    const ctx = { storeId, tx }
    const d = await createDraft(ctx, {
      email: 'raj@example.in',
      shipping,
      lines: [{ variantId: black, quantity: 2 }],
      discountPaise: 0,
      shippingPaise: 0,
    })
    await convertDraft(ctx, d.id, { paymentMethod: opts.paid ? 'fake' : 'cod' })
    if (opts.paid) {
      await tx
        .update(payment)
        .set({ status: 'captured', providerPaymentId: 'pay_1', provider: 'fake' })
        .where(eq(payment.orderId, d.id))
      await recomputeOrderStatuses(ctx, d.id)
    }
    return d.id
  })
}

async function level(variantId: string) {
  const [l] = await owner
    .select()
    .from(inventoryLevel)
    .where(eq(inventoryLevel.variantId, variantId))
  return { onHand: l?.onHand ?? 0, reserved: l?.reserved ?? 0 }
}

async function orderRow(id: string) {
  const [o] = await owner.select().from(order).where(eq(order.id, id))
  if (!o) throw new Error('missing order')
  return o
}

async function events(orderId: string) {
  const rows = await owner.select().from(outboxEvent)
  return rows
    .filter((r) => (r.payload as { orderId?: string }).orderId === orderId)
    .map((r) => r.type)
}

/** An open, paid order the Shopify import wrote: no stock held, a `shopify` payment. */
async function imported(storeId: string, black: string) {
  const [a] = await owner
    .insert(address)
    .values({ storeId, ...shipping })
    .returning()
  const [o] = await owner
    .insert(order)
    .values({
      storeId,
      number: 2331,
      status: 'open',
      paymentStatus: 'paid',
      fulfillmentStatus: 'unfulfilled',
      checkoutPaidAt: new Date(),
      subtotalPaise: 200000,
      totalPaise: 200000,
      email: 'krishna@example.in',
      shippingAddressId: a?.id,
      importedFrom: 'shopify',
      importMeta: {
        name: '#2331',
        financialStatus: 'paid',
        fulfillmentStatus: 'unfulfilled',
        paymentMethod: 'Razorpay',
      },
    })
    .returning()
  if (!o) throw new Error('seed')
  await owner.insert(orderLine).values({
    storeId,
    orderId: o.id,
    variantId: black,
    title: 'Glasspad',
    variantTitle: 'Black',
    quantity: 2,
    unitPricePaise: 100000,
  })
  await owner.insert(payment).values({
    storeId,
    orderId: o.id,
    provider: 'shopify',
    providerRef: '#2331',
    status: 'captured',
    amountPaise: 200000,
  })
  return o.id
}

describe('cancelOrderByStaff', () => {
  it('cancels a paid order, restocks, refunds to the original payment and records it', async () => {
    const { storeId, black } = await seed()
    const id = await placed(storeId, black)
    expect(await level(black)).toEqual({ onHand: 10, reserved: 2 })
    const g = gateway()
    await withStore(app, storeId, (tx) =>
      cancelOrderByStaff(
        { storeId, tx },
        {
          orderId: id,
          reason: 'Changed mind',
          restock: true,
          notifyCustomer: true,
          refund: 'original',
          author: STAFF,
        },
        [g],
      ),
    )
    const o = await orderRow(id)
    expect(o.status).toBe('cancelled')
    expect(o.paymentStatus).toBe('refunded')
    expect(await level(black)).toEqual({ onHand: 10, reserved: 0 })
    expect(g.calls).toEqual(['refund:pay_1:200000'])
    const [r] = await owner.select().from(refund).where(eq(refund.orderId, id))
    expect(r?.status).toBe('processed')
    expect(await events(id)).toEqual(
      expect.arrayContaining(['order.cancel_notice', 'refund.created']),
    )
    const notes = await owner.select().from(orderNote).where(eq(orderNote.orderId, id))
    expect(notes.at(-1)?.body).toContain('Reason: Changed mind')
    expect(notes.at(-1)?.author).toBe(STAFF)
  })

  it('stores the picked reason code and its note (#125)', async () => {
    const { storeId, black } = await seed()
    const id = await placed(storeId, black)
    await withStore(app, storeId, (tx) =>
      cancelOrderByStaff(
        { storeId, tx },
        {
          orderId: id,
          reasonCode: 'inventory',
          reason: 'Supplier delayed',
          restock: true,
          notifyCustomer: false,
          refund: 'manual',
          author: STAFF,
        },
        [gateway()],
      ),
    )
    const o = await orderRow(id)
    expect(o.cancelReason).toBe('inventory')
    expect(o.cancelNote).toBe('Supplier delayed')
    const notes = await owner.select().from(orderNote).where(eq(orderNote.orderId, id))
    expect(notes.at(-1)?.body).toContain('Reason: Out of stock. Note: Supplier delayed.')
  })

  it('writes stock off without restock, records a manual refund and stays quiet when asked', async () => {
    const { storeId, black } = await seed()
    const id = await placed(storeId, black)
    const g = gateway()
    await withStore(app, storeId, (tx) =>
      cancelOrderByStaff(
        { storeId, tx },
        { orderId: id, restock: false, notifyCustomer: false, refund: 'manual', author: STAFF },
        [g],
      ),
    )
    expect(await level(black)).toEqual({ onHand: 8, reserved: 0 })
    expect(g.calls).toEqual([])
    const [r] = await owner.select().from(refund).where(eq(refund.orderId, id))
    expect(r?.status).toBe('manual')
    const types = await events(id)
    expect(types).toContain('order.cancelled')
    expect(types).not.toContain('order.cancel_notice')
  })

  it('takes an open imported order over first, and refuses a gateway refund of its Shopify payment', async () => {
    const { storeId, black } = await seed()
    const id = await imported(storeId, black)
    await expect(
      withStore(app, storeId, (tx) =>
        cancelOrderByStaff(
          { storeId, tx },
          { orderId: id, restock: false, notifyCustomer: false, refund: 'original', author: STAFF },
          [gateway()],
        ),
      ),
    ).rejects.toBeInstanceOf(RefundNotAllowed)
    // Rolled back: still imported, stock untouched.
    expect((await orderRow(id)).importedFrom).toBe('shopify')
    expect(await level(black)).toEqual({ onHand: 10, reserved: 0 })

    await withStore(app, storeId, (tx) =>
      cancelOrderByStaff(
        { storeId, tx },
        { orderId: id, restock: false, notifyCustomer: false, refund: 'manual', author: STAFF },
        [gateway()],
      ),
    )
    const o = await orderRow(id)
    expect(o.status).toBe('cancelled')
    expect(o.importedFrom).toBeNull()
    expect(o.importMeta?.takenOver?.source).toBe('shopify')
    // Restock off: the units held at takeover are written off again, availability as imported.
    expect(await level(black)).toEqual({ onHand: 10, reserved: 0 })
    const [r] = await owner.select().from(refund).where(eq(refund.orderId, id))
    expect(r).toMatchObject({ status: 'manual', amountPaise: 200000 })
  })

  it('gives the money back as store credit: one gift card, recorded as the refund', async () => {
    const { storeId, black } = await seed()
    const id = await placed(storeId, black)
    const g = gateway()
    await withStore(app, storeId, (tx) =>
      cancelOrderByStaff(
        { storeId, tx },
        {
          orderId: id,
          restock: true,
          notifyCustomer: false,
          refund: 'store_credit',
          author: STAFF,
          settingsSecret: 'test-secret-test-secret-test-secret',
        },
        [g],
      ),
    )
    expect(g.calls).toEqual([])
    const rows = await owner.select().from(refund).where(eq(refund.orderId, id))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ method: 'store_credit', status: 'manual', amountPaise: 200000 })
    const [card] = await owner.select().from(giftCard).where(eq(giftCard.orderId, id))
    expect(card).toMatchObject({ initialValuePaise: 200000, balancePaise: 200000 })
    expect(rows[0]?.giftCardId).toBe(card?.id)
    expect((await orderRow(id)).paymentStatus).toBe('refunded')
    const notes = await owner.select().from(orderNote).where(eq(orderNote.orderId, id))
    expect(notes.at(-1)?.body).toContain('given back as store credit')
  })

  it('says what was kept when the merchant chooses no refund', async () => {
    const { storeId, black } = await seed()
    const id = await placed(storeId, black)
    await withStore(app, storeId, (tx) =>
      cancelOrderByStaff(
        { storeId, tx },
        { orderId: id, restock: true, notifyCustomer: false, refund: 'none', author: STAFF },
        [gateway()],
      ),
    )
    const notes = await owner.select().from(orderNote).where(eq(orderNote.orderId, id))
    expect(notes.at(-1)?.body).toContain('Not refunded: ₹2,000.00 left to refund.')
    expect(notes.at(-1)?.body).not.toContain('Nothing to refund')
  })

  it('puts an imported order’s items back on sale when restock is on', async () => {
    const { storeId, black } = await seed()
    const id = await imported(storeId, black)
    await withStore(app, storeId, (tx) =>
      cancelOrderByStaff(
        { storeId, tx },
        { orderId: id, restock: true, notifyCustomer: false, refund: 'none', author: STAFF },
        [],
      ),
    )
    expect(await level(black)).toEqual({ onHand: 12, reserved: 0 })
    expect(await owner.select().from(refund).where(eq(refund.orderId, id))).toHaveLength(0)
  })
})

describe('takeOverImportedOrder', () => {
  it('makes the order workable without changing available stock, and notes it', async () => {
    const { storeId, black } = await seed()
    const id = await imported(storeId, black)
    await withStore(app, storeId, (tx) => takeOverImportedOrder({ storeId, tx }, id, STAFF))
    const o = await orderRow(id)
    expect(o.importedFrom).toBeNull()
    expect(o.importMeta?.takenOver).toMatchObject({ by: STAFF, source: 'shopify' })
    expect(o.paymentStatus).toBe('paid')
    // On hand and committed both +2: available (10) is what the import said.
    expect(await level(black)).toEqual({ onHand: 12, reserved: 2 })
    const parcels = await owner
      .select()
      .from(fulfillmentOrder)
      .where(eq(fulfillmentOrder.orderId, id))
    expect(parcels).toHaveLength(1)
    const notes = await owner.select().from(orderNote).where(eq(orderNote.orderId, id))
    expect(notes[0]?.body).toContain('Imported from Shopify')
    // A second call is harmless.
    await withStore(app, storeId, (tx) => takeOverImportedOrder({ storeId, tx }, id, STAFF))
    expect(await level(black)).toEqual({ onHand: 12, reserved: 2 })
  })

  it('refuses imported history (shipped)', async () => {
    const { storeId, black } = await seed()
    const id = await imported(storeId, black)
    await owner.update(order).set({ fulfillmentStatus: 'fulfilled' }).where(eq(order.id, id))
    await expect(
      withStore(app, storeId, (tx) => takeOverImportedOrder({ storeId, tx }, id, STAFF)),
    ).rejects.toMatchObject({ code: 'ORDER_NOT_TAKEABLE' })
  })
})

const edit = (input: unknown) => OrderEditSchema.parse(input)

describe('editOrder', () => {
  it('adds an item: stock held, totals up, a balance the customer is asked for', async () => {
    const { storeId, black, white } = await seed()
    const id = await placed(storeId, black)
    const input = edit({ orderId: id, add: [{ variantId: white, quantity: 1 }] })
    const preview = await withStore(app, storeId, (tx) =>
      previewOrderEdit({ storeId, tx }, input, [gateway()]),
    )
    expect(preview.after.totalPaise).toBe(250000)
    expect(preview.differencePaise).toBe(50000)
    const r = await withStore(app, storeId, (tx) =>
      editOrder({ storeId, tx }, input, { refund: 'none', requestPayment: true, author: STAFF }, [
        gateway(),
      ]),
    )
    expect(r.settlement).toMatchObject({ kind: 'requested', amountPaise: 50000 })
    const o = await orderRow(id)
    expect(o).toMatchObject({ totalPaise: 250000, subtotalPaise: 250000, balanceDuePaise: 50000 })
    expect(o.paymentStatus).toBe('partially_paid')
    expect(await level(white)).toEqual({ onHand: 4, reserved: 1 })
    const lines = await owner.select().from(orderLine).where(eq(orderLine.orderId, id))
    expect(lines).toHaveLength(2)
    expect(await events(id)).toEqual(
      expect.arrayContaining(['order.edited', 'order.balance_requested']),
    )
    // Collected by hand later: the balance settles and the order is paid again.
    const notes = await owner.select().from(orderNote).where(eq(orderNote.orderId, id))
    expect(
      notes.some((n) => n.body.startsWith('Order edited:\n+ Added 1 × Glasspad (White)')),
    ).toBe(true)
  })

  it('lowers a quantity: stock released, the difference refunded and tagged as an edit', async () => {
    const { storeId, black } = await seed()
    const id = await placed(storeId, black)
    const [line] = await owner.select().from(orderLine).where(eq(orderLine.orderId, id))
    const g = gateway()
    const r = await withStore(app, storeId, (tx) =>
      editOrder(
        { storeId, tx },
        edit({ orderId: id, lines: [{ lineId: line?.id, quantity: 1 }] }),
        { refund: 'original', requestPayment: false, author: STAFF },
        [g],
      ),
    )
    expect(r.settlement).toMatchObject({ kind: 'refunded', amountPaise: 100000 })
    expect(g.calls).toEqual(['refund:pay_1:100000'])
    expect(await level(black)).toEqual({ onHand: 10, reserved: 1 })
    const [rf] = await owner.select().from(refund).where(eq(refund.orderId, id))
    expect(rf?.reason).toBe(ORDER_EDIT_REFUND_REASON)
    const o = await orderRow(id)
    expect(o.totalPaise).toBe(100000)
    const parcelLines = await owner.select().from(fulfillmentOrderLine)
    expect(parcelLines.map((l) => l.quantity)).toEqual([1])
  })

  it('removes a line, swaps in another and changes shipping and discount', async () => {
    const { storeId, black, white } = await seed()
    const id = await placed(storeId, black)
    const [line] = await owner.select().from(orderLine).where(eq(orderLine.orderId, id))
    await withStore(app, storeId, (tx) =>
      editOrder(
        { storeId, tx },
        edit({
          orderId: id,
          lines: [{ lineId: line?.id, quantity: 0 }],
          add: [{ variantId: white, quantity: 2, unitPricePaise: 60000 }],
          shippingPaise: 5000,
          discountPaise: 10000,
        }),
        { refund: 'manual', requestPayment: false, author: STAFF },
        [gateway()],
      ),
    )
    const o = await orderRow(id)
    // 2 × ₹600 − ₹100 + ₹50 = ₹1,150 against ₹2,000 paid: ₹850 back by hand.
    expect(o).toMatchObject({ subtotalPaise: 120000, discountPaise: 10000, shippingPaise: 5000 })
    expect(o.totalPaise).toBe(115000)
    expect(await level(black)).toEqual({ onHand: 10, reserved: 0 })
    expect(await level(white)).toEqual({ onHand: 4, reserved: 2 })
    const lines = await owner.select().from(orderLine).where(eq(orderLine.orderId, id))
    expect(lines.map((l) => l.variantId)).toEqual([white])
    const [rf] = await owner.select().from(refund).where(eq(refund.orderId, id))
    expect(rf).toMatchObject({ status: 'manual', amountPaise: 85000 })
  })

  it('refuses taking a packed line below what was packed, and an edit that changes nothing', async () => {
    const { storeId, black } = await seed()
    const id = await placed(storeId, black)
    const [line] = await owner.select().from(orderLine).where(eq(orderLine.orderId, id))
    await owner
      .update(orderLine)
      .set({ fulfilledQuantity: 1 })
      .where(eq(orderLine.id, line?.id as string))
    await expect(
      withStore(app, storeId, (tx) =>
        previewOrderEdit(
          { storeId, tx },
          edit({ orderId: id, lines: [{ lineId: line?.id, quantity: 0 }] }),
          [],
        ),
      ),
    ).rejects.toMatchObject({ reason: 'fulfilled_line' })
    await expect(
      withStore(app, storeId, (tx) => previewOrderEdit({ storeId, tx }, edit({ orderId: id }), [])),
    ).rejects.toBeInstanceOf(OrderEditRefused)
  })

  it('refuses adding more than the store has, leaving the order as it was', async () => {
    const { storeId, black, white } = await seed()
    const id = await placed(storeId, black)
    await expect(
      withStore(app, storeId, (tx) =>
        editOrder(
          { storeId, tx },
          edit({ orderId: id, add: [{ variantId: white, quantity: 9 }] }),
          { refund: 'none', requestPayment: false, author: STAFF },
          [],
        ),
      ),
    ).rejects.toBeInstanceOf(OutOfStock)
    expect((await orderRow(id)).totalPaise).toBe(200000)
  })

  it('on an unpaid cash on delivery order moves the amount to collect instead of settling', async () => {
    const { storeId, black, white } = await seed()
    const id = await placed(storeId, black, { paid: false })
    const r = await withStore(app, storeId, (tx) =>
      editOrder(
        { storeId, tx },
        edit({ orderId: id, add: [{ variantId: white, quantity: 1 }] }),
        { refund: 'none', requestPayment: true, author: STAFF },
        [],
      ),
    )
    expect(r.settlement.kind).toBe('none')
    const [p] = await owner
      .select()
      .from(payment)
      .where(and(eq(payment.orderId, id)))
    expect(p?.amountPaise).toBe(250000)
    expect((await orderRow(id)).balanceDuePaise).toBeNull()
  })

  it('reprices an existing line and labels shipping and discount (issues 917, 918, 919)', async () => {
    const { storeId, black } = await seed()
    const id = await placed(storeId, black)
    const [line] = await owner.select().from(orderLine).where(eq(orderLine.orderId, id))
    const input = edit({
      orderId: id,
      lines: [{ lineId: line?.id, quantity: 2, unitPricePaise: 80000 }],
      shippingPaise: 9900,
      shippingLabel: 'Bluedart',
      discountPaise: 5000,
      discountLabel: ' UPI discount ',
    })
    const preview = await withStore(app, storeId, (tx) =>
      previewOrderEdit({ storeId, tx }, input, [gateway()]),
    )
    // 2 × ₹800 − ₹50 + ₹99 = ₹1,649 against ₹2,000 paid: ₹351 owed back.
    expect(preview.after).toMatchObject({ subtotalPaise: 160000, totalPaise: 164900 })
    expect(preview.differencePaise).toBe(-35100)
    expect(preview.lines[0]).toMatchObject({
      change: 'changed',
      unitPriceBefore: 100000,
      unitPricePaise: 80000,
    })
    const r = await withStore(app, storeId, (tx) =>
      editOrder(
        { storeId, tx },
        input,
        { refund: 'manual', requestPayment: false, author: STAFF },
        [gateway()],
      ),
    )
    expect(r.settlement).toMatchObject({ kind: 'refunded', amountPaise: 35100 })
    const o = await orderRow(id)
    expect(o).toMatchObject({
      subtotalPaise: 160000,
      discountPaise: 5000,
      shippingPaise: 9900,
      totalPaise: 164900,
      discountLabel: 'UPI discount',
      shippingRateName: 'Bluedart',
    })
    // GST follows the new price: 18% inside ₹1,649.
    expect(o.taxPaise).toBe(Math.round((164900 * 18) / 118))
    const [after] = await owner.select().from(orderLine).where(eq(orderLine.orderId, id))
    expect(after).toMatchObject({ quantity: 2, unitPricePaise: 80000 })
    // Same quantity: no stock moved.
    expect(await level(black)).toEqual({ onHand: 10, reserved: 2 })
    const [rf] = await owner.select().from(refund).where(eq(refund.orderId, id))
    expect(rf).toMatchObject({ status: 'manual', amountPaise: 35100 })
    const notes = await owner.select().from(orderNote).where(eq(orderNote.orderId, id))
    const body = notes.map((n) => n.body).join(' ')
    expect(body).toContain('Glasspad (Black) price ₹1,000.00 → ₹800.00')
    expect(body).toContain('shipping label none → "Bluedart"')
    expect(body).toContain('discount label none → "UPI discount"')
  })

  it('raises a price: the customer owes the difference as a balance', async () => {
    const { storeId, black } = await seed()
    const id = await placed(storeId, black)
    const [line] = await owner.select().from(orderLine).where(eq(orderLine.orderId, id))
    const r = await withStore(app, storeId, (tx) =>
      editOrder(
        { storeId, tx },
        edit({ orderId: id, lines: [{ lineId: line?.id, quantity: 2, unitPricePaise: 125000 }] }),
        { refund: 'none', requestPayment: false, author: STAFF },
        [gateway()],
      ),
    )
    expect(r.settlement).toMatchObject({ kind: 'owed', amountPaise: 50000 })
    const o = await orderRow(id)
    expect(o).toMatchObject({ totalPaise: 250000, balanceDuePaise: 50000 })
    expect(o.paymentStatus).toBe('partially_paid')
  })

  it('saves a label on its own; the money stays as it was', async () => {
    const { storeId, black } = await seed()
    const id = await placed(storeId, black)
    const r = await withStore(app, storeId, (tx) =>
      editOrder(
        { storeId, tx },
        edit({ orderId: id, shippingLabel: 'Bluedart' }),
        { refund: 'none', requestPayment: false, author: STAFF },
        [],
      ),
    )
    expect(r.settlement.kind).toBe('none')
    const o = await orderRow(id)
    expect(o).toMatchObject({ totalPaise: 200000, shippingRateName: 'Bluedart' })
    // The same label again is no change.
    await expect(
      withStore(app, storeId, (tx) =>
        previewOrderEdit({ storeId, tx }, edit({ orderId: id, shippingLabel: 'Bluedart' }), []),
      ),
    ).rejects.toMatchObject({ reason: 'no_change' })
  })

  it('edits a shipped order: the sent parcel keeps its money, added items go in a new parcel', async () => {
    const { storeId, black, white } = await seed()
    const id = await withStore(app, storeId, async (tx) => {
      const ctx = { storeId, tx }
      const d = await createDraft(ctx, {
        email: 'raj@example.in',
        shipping,
        lines: [{ variantId: black, quantity: 2 }],
        discountPaise: 0,
        shippingPaise: 10000,
      })
      await convertDraft(ctx, d.id, { paymentMethod: 'fake' })
      await tx
        .update(payment)
        .set({ status: 'captured', providerPaymentId: 'pay_1', provider: 'fake' })
        .where(eq(payment.orderId, d.id))
      return d.id
    })
    // Packed and handed over: every unit fulfilled, the parcel closed.
    await owner.update(orderLine).set({ fulfilledQuantity: 2 }).where(eq(orderLine.orderId, id))
    await owner.update(fulfillmentOrderLine).set({ fulfilledQuantity: 2 })
    await owner
      .update(fulfillmentOrder)
      .set({ status: 'fulfilled' })
      .where(eq(fulfillmentOrder.orderId, id))
    await withStore(app, storeId, (tx) => recomputeOrderStatuses({ storeId, tx }, id))
    expect((await orderRow(id)).fulfillmentStatus).toBe('fulfilled')
    const [sent] = await owner
      .select()
      .from(fulfillmentOrder)
      .where(eq(fulfillmentOrder.orderId, id))
    const [line] = await owner.select().from(orderLine).where(eq(orderLine.orderId, id))

    // Below what was sent is still refused: that is a return.
    await expect(
      withStore(app, storeId, (tx) =>
        previewOrderEdit(
          { storeId, tx },
          edit({ orderId: id, lines: [{ lineId: line?.id, quantity: 1 }] }),
          [],
        ),
      ),
    ).rejects.toMatchObject({ reason: 'fulfilled_line' })

    await withStore(app, storeId, (tx) =>
      editOrder(
        { storeId, tx },
        edit({ orderId: id, add: [{ variantId: white, quantity: 1 }] }),
        { refund: 'none', requestPayment: false, author: STAFF },
        [gateway()],
      ),
    )
    const o = await orderRow(id)
    expect(o.totalPaise).toBe(260000)
    const parcels = await owner
      .select()
      .from(fulfillmentOrder)
      .where(eq(fulfillmentOrder.orderId, id))
    const kept = parcels.find((p) => p.id === sent?.id)
    const fresh = parcels.find((p) => p.id !== sent?.id)
    // The sent parcel still bills what went out with it, shipping included.
    expect(kept).toMatchObject({
      status: 'fulfilled',
      totalPaise: sent?.totalPaise,
      shippingPaise: sent?.shippingPaise,
      taxPaise: sent?.taxPaise,
    })
    expect(fresh).toMatchObject({ status: 'open', totalPaise: 50000, shippingPaise: 0 })
    expect(o.taxPaise).toBe((kept?.taxPaise ?? 0) + (fresh?.taxPaise ?? 0))
    expect(await level(white)).toEqual({ onHand: 4, reserved: 1 })
    const notes = await owner.select().from(orderNote).where(eq(orderNote.orderId, id))
    expect(notes.some((n) => n.body.startsWith('Order edited after shipping'))).toBe(true)
  })

  it('refuses a completed order', async () => {
    const { storeId, black } = await seed()
    const id = await placed(storeId, black)
    await owner.update(order).set({ status: 'completed' }).where(eq(order.id, id))
    await expect(
      withStore(app, storeId, (tx) =>
        previewOrderEdit({ storeId, tx }, edit({ orderId: id, shippingLabel: 'Bluedart' }), []),
      ),
    ).rejects.toMatchObject({ reason: 'not_editable' })
  })

  it('refuses an imported order until it is taken over', async () => {
    const { storeId, black, white } = await seed()
    const id = await imported(storeId, black)
    const input = edit({ orderId: id, add: [{ variantId: white, quantity: 1 }] })
    await expect(
      withStore(app, storeId, (tx) => previewOrderEdit({ storeId, tx }, input, [])),
    ).rejects.toMatchObject({ reason: 'not_editable' })
    await withStore(app, storeId, (tx) => takeOverImportedOrder({ storeId, tx }, id, STAFF))
    const r = await withStore(app, storeId, (tx) =>
      editOrder(
        { storeId, tx },
        input,
        { refund: 'none', requestPayment: false, author: STAFF },
        [],
      ),
    )
    expect(r.settlement).toMatchObject({ kind: 'owed', amountPaise: 50000 })
  })
})

describe('duplicateOrderAsDraft phone', () => {
  it('copies the shipping address phone when the order has no contact phone of its own', async () => {
    const { storeId, black } = await seed()
    const id = await placed(storeId, black)
    await owner.update(order).set({ phone: null }).where(eq(order.id, id))
    const copy = await withStore(app, storeId, (tx) => duplicateOrderAsDraft({ storeId, tx }, id))
    expect((await orderRow(copy?.id as string)).phone).toBe('9777922152')
  })
})
