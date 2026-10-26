import { ORDER_EDIT_REFUND_REASON } from '@commerce/core'
import {
  address,
  createDb,
  customer,
  order,
  orderLine,
  payment,
  product,
  refund,
  type StoreTx,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { applyAsAffiliate } from '../src/affiliates'
import { recomputeCommissionForEdit } from '../src/commission-edit'
import { applyRefunds, creditOrder } from '../src/commissions'
import { affiliateCommission, affiliatePayout } from '../src/schema'
import { type AffiliateSettings, defaultAffiliateSettings } from '../src/settings'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const SECRET = 'test-secret-test-secret-test-secret-00'
const settings: AffiliateSettings = { ...defaultAffiliateSettings, approval: 'auto' }

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const inStore = <T>(storeId: string, fn: (tx: StoreTx) => Promise<T>) => withStore(app, storeId, fn)

/** A paid order for 1 × ₹1,180 credited to an affiliate's link: a ₹100 pending commission. */
async function credited() {
  const [s] = await owner.insert(store).values({ slug: 'w', name: 'W' }).returning()
  if (!s) throw new Error('seed')
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'mat', title: 'Mat' })
    .returning()
  const [v] = await owner
    .insert(variant)
    .values({ storeId: s.id, productId: p?.id as string, title: 'Default', pricePaise: 1180_00 })
    .returning()
  const [c] = await owner
    .insert(customer)
    .values({ storeId: s.id, email: 'asha@example.com', name: 'Asha' })
    .returning()
  const a = await inStore(s.id, (tx) =>
    applyAsAffiliate(
      tx,
      s.id,
      {
        customerId: c?.id ?? null,
        email: 'asha@example.com',
        phone: '+91 98765 43210',
        name: 'Asha K',
        social: '@asha',
        message: '',
      },
      settings,
      SECRET,
    ),
  )
  const [addr] = await owner
    .insert(address)
    .values({
      storeId: s.id,
      name: 'Buyer',
      line1: '5 Park Street',
      city: 'Kolkata',
      stateCode: 'WB',
      pincode: '700016',
      phone: '9000000001',
    })
    .returning()
  const [o] = await owner
    .insert(order)
    .values({
      storeId: s.id,
      number: 1001,
      email: 'buyer@example.com',
      shippingAddressId: addr?.id,
      status: 'open',
      paymentStatus: 'paid',
      subtotalPaise: 1180_00,
      totalPaise: 1180_00,
      attribution: { channel: 'affiliate', ref: a.code, at: new Date().toISOString() },
    })
    .returning()
  if (!o || !v) throw new Error('seed')
  const [line] = await owner
    .insert(orderLine)
    .values({
      storeId: s.id,
      orderId: o.id,
      variantId: v.id,
      quantity: 1,
      unitPricePaise: 1180_00,
      gstRatePercent: 18,
    })
    .returning()
  const row = await inStore(s.id, (tx) => creditOrder(tx, s.id, o.id, settings, SECRET))
  expect(row).toMatchObject({ status: 'pending', commissionPaise: 100_00 })
  return {
    storeId: s.id,
    orderId: o.id,
    lineId: line?.id as string,
    commissionId: row?.id as string,
  }
}

/** What an order edit does to the order: a second unit, or back to one with the edit's refund. */
async function setQuantity(orderId: string, lineId: string, quantity: number) {
  await owner.update(orderLine).set({ quantity }).where(eq(orderLine.id, lineId))
  await owner
    .update(order)
    .set({ subtotalPaise: quantity * 1180_00, totalPaise: quantity * 1180_00 })
    .where(eq(order.id, orderId))
}

async function commission(id: string) {
  const [c] = await owner.select().from(affiliateCommission).where(eq(affiliateCommission.id, id))
  return c
}

describe('recomputeCommissionForEdit', () => {
  it('rewrites a pending commission up and down with the edited lines', async () => {
    const t = await credited()
    await setQuantity(t.orderId, t.lineId, 2)
    await inStore(t.storeId, (tx) => recomputeCommissionForEdit(tx, t.storeId, t.orderId))
    expect(await commission(t.commissionId)).toMatchObject({
      basePaise: 2000_00,
      earnedPaise: 200_00,
      commissionPaise: 200_00,
    })
    await setQuantity(t.orderId, t.lineId, 1)
    await inStore(t.storeId, (tx) => recomputeCommissionForEdit(tx, t.storeId, t.orderId))
    expect(await commission(t.commissionId)).toMatchObject({ commissionPaise: 100_00 })
  })

  it('never raises an approved commission, and lowers its TDS with it', async () => {
    const t = await credited()
    await owner
      .update(affiliateCommission)
      .set({ status: 'approved', tdsPaise: 5_00 })
      .where(eq(affiliateCommission.id, t.commissionId))
    await setQuantity(t.orderId, t.lineId, 2)
    await inStore(t.storeId, (tx) => recomputeCommissionForEdit(tx, t.storeId, t.orderId))
    expect(await commission(t.commissionId)).toMatchObject({ commissionPaise: 100_00 })
    // Down to a cheaper line price: ₹590 → ₹50.
    await owner.update(orderLine).set({ unitPricePaise: 590_00 }).where(eq(orderLine.id, t.lineId))
    await owner
      .update(order)
      .set({ subtotalPaise: 1180_00, totalPaise: 1180_00 })
      .where(eq(order.id, t.orderId))
    await inStore(t.storeId, (tx) => recomputeCommissionForEdit(tx, t.storeId, t.orderId))
    expect(await commission(t.commissionId)).toMatchObject({ commissionPaise: 100_00 })
    await owner
      .update(order)
      .set({ subtotalPaise: 590_00, totalPaise: 590_00 })
      .where(eq(order.id, t.orderId))
    await owner.update(orderLine).set({ quantity: 1 }).where(eq(orderLine.id, t.lineId))
    await inStore(t.storeId, (tx) => recomputeCommissionForEdit(tx, t.storeId, t.orderId))
    const c = await commission(t.commissionId)
    expect(c?.commissionPaise).toBe(50_00)
    expect(c?.tdsPaise).toBe(2_50)
    expect(c?.status).toBe('approved')
  })

  it('claws back the drop on a commission already in a payout', async () => {
    const t = await credited()
    const before = await commission(t.commissionId)
    const [payout] = await owner
      .insert(affiliatePayout)
      .values({
        storeId: t.storeId,
        affiliateId: before?.affiliateId as string,
        grossPaise: 100_00,
        netPaise: 100_00,
        status: 'paid',
      })
      .returning()
    await owner
      .update(affiliateCommission)
      .set({ status: 'paid', payoutId: payout?.id })
      .where(eq(affiliateCommission.id, t.commissionId))
    await owner.update(orderLine).set({ unitPricePaise: 590_00 }).where(eq(orderLine.id, t.lineId))
    await owner
      .update(order)
      .set({ subtotalPaise: 590_00, totalPaise: 590_00 })
      .where(eq(order.id, t.orderId))
    await inStore(t.storeId, (tx) => recomputeCommissionForEdit(tx, t.storeId, t.orderId))
    const c = await commission(t.commissionId)
    expect(c?.commissionPaise).toBe(50_00)
    expect(c?.clawbackPaise).toBe(50_00)
    expect(c?.status).toBe('paid')
  })

  it('leaves an edit’s own refund out of the refund scaling', async () => {
    const t = await credited()
    await setQuantity(t.orderId, t.lineId, 2)
    await inStore(t.storeId, (tx) => recomputeCommissionForEdit(tx, t.storeId, t.orderId))
    const [p] = await owner
      .insert(payment)
      .values({
        storeId: t.storeId,
        orderId: t.orderId,
        provider: 'manual',
        providerRef: 'm1',
        status: 'captured',
        amountPaise: 2360_00,
      })
      .returning()
    // The edit took one unit off again and refunded it.
    await setQuantity(t.orderId, t.lineId, 1)
    await owner.insert(refund).values({
      storeId: t.storeId,
      orderId: t.orderId,
      paymentId: p?.id as string,
      amountPaise: 1180_00,
      reason: ORDER_EDIT_REFUND_REASON,
      status: 'manual',
    })
    await inStore(t.storeId, (tx) => applyRefunds(tx, t.storeId, t.orderId))
    await inStore(t.storeId, (tx) => recomputeCommissionForEdit(tx, t.storeId, t.orderId))
    const c = await commission(t.commissionId)
    expect(c?.status).toBe('pending')
    expect(c?.commissionPaise).toBe(100_00)
  })
})
