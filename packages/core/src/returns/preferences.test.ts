/** SOURCE OF TRUTH: returns gaps tests — exchange options, the shopper's exchange choice and the draft it becomes, the auto-approve rule, and the return reasons report */
import {
  address,
  createDb,
  customer,
  inventoryLevel,
  order,
  orderLine,
  outboxEvent,
  payment,
  product,
  returnRequest,
  returnRequestLine,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { StoreContext } from '../context'
import { defaultReturnPolicy, qualifiesForAutoApprove } from './policy'
import { exchangeOptions } from './preferences'
import { returnReasonsReport } from './report'
import { exchangeReturn } from './resolve'
import { receiveReturn, requestReturn, saveReturnPolicy } from './service'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const inStore = <T>(storeId: string, fn: (ctx: StoreContext) => Promise<T>) =>
  withStore(app, storeId, (tx) => fn({ storeId, tx }))

async function seed() {
  const [s] = await owner
    .insert(store)
    .values({ slug: `x-${Math.random().toString(36).slice(2)}`, name: 'Waimers' })
    .returning()
  if (!s) throw new Error('seed')
  const [cu] = await owner
    .insert(customer)
    .values({ storeId: s.id, email: 'asha@example.com', name: 'Asha' })
    .returning()
  const [a] = await owner
    .insert(address)
    .values({
      storeId: s.id,
      name: 'Asha',
      line1: '12 MG Road',
      city: 'Bengaluru',
      stateCode: 'KA',
      pincode: '560001',
      phone: '9999999999',
    })
    .returning()
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'tee', title: 'Tee', status: 'active' })
    .returning()
  const [large, small, medium] = await owner
    .insert(variant)
    .values(
      ['Large', 'Small', 'Medium'].map((title, position) => ({
        storeId: s.id,
        productId: p?.id as string,
        title,
        position,
        pricePaise: 100000,
      })),
    )
    .returning()
  if (!large || !small || !medium) throw new Error('seed')
  await owner.insert(inventoryLevel).values([
    { storeId: s.id, variantId: large.id, onHand: 5 },
    { storeId: s.id, variantId: small.id, onHand: 3 },
    // Medium is sold out, so it is never offered.
    { storeId: s.id, variantId: medium.id, onHand: 0 },
  ])
  const [o] = await owner
    .insert(order)
    .values({
      storeId: s.id,
      number: 1,
      status: 'open',
      customerId: cu?.id,
      subtotalPaise: 200000,
      totalPaise: 200000,
      paymentMethod: 'manual',
      email: 'asha@example.com',
      shippingAddressId: a?.id,
      deliveredAt: new Date(),
    })
    .returning()
  if (!o) throw new Error('seed')
  const [line] = await owner
    .insert(orderLine)
    .values({
      storeId: s.id,
      orderId: o.id,
      variantId: large.id,
      title: 'Tee',
      variantTitle: 'Large',
      quantity: 2,
      fulfilledQuantity: 2,
      unitPricePaise: 100000,
    })
    .returning()
  await owner.insert(payment).values({
    storeId: s.id,
    orderId: o.id,
    provider: 'manual',
    providerRef: `ref_${o.id}`,
    status: 'captured',
    amountPaise: 200000,
  })
  return {
    storeId: s.id,
    orderId: o.id,
    lineId: line?.id as string,
    customerId: cu?.id as string,
    small: small.id,
    medium: medium.id,
  }
}

describe('auto-approve rule (pure)', () => {
  const policy = {
    ...defaultReturnPolicy,
    autoApprove: { enabled: true, reasons: ['damaged' as const], maxValuePaise: 150000 },
  }
  it('takes shopper requests for listed reasons up to the limit only', () => {
    const req = { reason: 'damaged' as const, valuePaise: 100000, requestedBy: 'customer' as const }
    expect(qualifiesForAutoApprove(policy, req)).toBe(true)
    expect(qualifiesForAutoApprove(policy, { ...req, valuePaise: 200000 })).toBe(false)
    expect(qualifiesForAutoApprove(policy, { ...req, reason: 'size' })).toBe(false)
    expect(qualifiesForAutoApprove(policy, { ...req, requestedBy: 'merchant' })).toBe(false)
    expect(qualifiesForAutoApprove(defaultReturnPolicy, req)).toBe(false)
    expect(
      qualifiesForAutoApprove(
        { ...policy, autoApprove: { ...policy.autoApprove, maxValuePaise: 0 } },
        { ...req, valuePaise: 9_999_999 },
      ),
    ).toBe(true)
  })
})

describe('returns gaps', () => {
  it('offers in-stock sibling variants, and turns an exchange request into that draft', async () => {
    const s = await seed()
    const options = await inStore(s.storeId, (ctx) => exchangeOptions(ctx, s.orderId))
    expect(options.get(s.lineId)).toEqual([{ variantId: s.small, title: 'Small' }])

    const ask = {
      orderId: s.orderId,
      lines: [{ orderLineId: s.lineId, quantity: 1 }],
      reason: 'size' as const,
      requestedBy: 'customer' as const,
      customerId: s.customerId,
      preference: 'exchange' as const,
      exchange: [{ orderLineId: s.lineId, variantId: s.small }],
    }
    await inStore(s.storeId, (ctx) =>
      saveReturnPolicy(ctx, { reasons: ['size', 'damaged'], exchanges: false }),
    )
    await expect(inStore(s.storeId, (ctx) => requestReturn(ctx, ask))).rejects.toThrow(/exchanges/)
    await inStore(s.storeId, (ctx) =>
      saveReturnPolicy(ctx, { reasons: ['size', 'damaged'], exchanges: true }),
    )
    await expect(
      inStore(s.storeId, (ctx) =>
        requestReturn(ctx, { ...ask, exchange: [{ orderLineId: s.lineId, variantId: s.medium }] }),
      ),
    ).rejects.toThrow(/not available/)
    const r = await inStore(s.storeId, (ctx) => requestReturn(ctx, ask))
    const [row] = await owner.select().from(returnRequest).where(eq(returnRequest.id, r.id))
    expect(row).toMatchObject({ status: 'requested', preferredResolution: 'exchange' })
    const [line] = await owner
      .select()
      .from(returnRequestLine)
      .where(eq(returnRequestLine.returnRequestId, r.id))
    expect(line?.exchangeVariantId).toBe(s.small)

    await owner
      .update(returnRequest)
      .set({ status: 'approved', approvedAt: new Date() })
      .where(eq(returnRequest.id, r.id))
    await inStore(s.storeId, (ctx) => receiveReturn(ctx, r.id, { condition: 'good' }))
    const ex = await inStore(s.storeId, (ctx) => exchangeReturn(ctx, r.id))
    const draftLines = await owner.select().from(orderLine).where(eq(orderLine.orderId, ex.draftId))
    expect(draftLines.map((l) => [l.variantId, l.quantity])).toEqual([[s.small, 1]])
  })

  it('approves matching shopper requests at once, and reports reasons', async () => {
    const s = await seed()
    await inStore(s.storeId, (ctx) =>
      saveReturnPolicy(ctx, {
        reasons: ['damaged', 'quality'],
        autoApprove: { enabled: true, reasons: ['damaged'], maxValuePaise: 0 },
      }),
    )
    const base = {
      orderId: s.orderId,
      lines: [{ orderLineId: s.lineId, quantity: 1 }],
      requestedBy: 'customer' as const,
      customerId: s.customerId,
    }
    const auto = await inStore(s.storeId, (ctx) =>
      requestReturn(ctx, { ...base, reason: 'damaged' }),
    )
    expect(auto).toMatchObject({ status: 'approved', autoApproved: true })
    const approved = await owner
      .select()
      .from(outboxEvent)
      .where(and(eq(outboxEvent.storeId, s.storeId), eq(outboxEvent.type, 'return.approved')))
    expect(approved).toHaveLength(1)
    const manual = await inStore(s.storeId, (ctx) =>
      requestReturn(ctx, { ...base, reason: 'quality' }),
    )
    expect(manual).toMatchObject({ status: 'requested', autoApproved: false })

    const report = await inStore(s.storeId, (ctx) => returnReasonsReport(ctx, 30))
    expect(report).toMatchObject({ returns: 2, autoApproved: 1, exchanges: 0 })
    expect(report.reasons.map((r) => [r.reason, r.returns, r.units, r.sharePercent])).toEqual([
      ['damaged', 1, 1, 50],
      ['quality', 1, 1, 50],
    ])
    expect(report.products[0]).toMatchObject({ title: 'Tee', returns: 2, units: 2 })
  })
})
