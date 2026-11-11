/** SOURCE OF TRUTH: store credit on draft orders tests — WHAT: applying store credit to a draft, converting it (full and part cover, staff and online invoice), deleting or changing the draft, a balance spent elsewhere, and two converts at once / WHY: store credit is the customer's own money, so a draft must take it exactly once and never lose it */
import {
  createDb,
  customer,
  inventoryLevel,
  order,
  payment,
  product,
  store,
  storeCreditAccount,
  storeCreditEntry,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { StoreContext } from '../context'
import { changeStoreCredit, StoreCreditError } from '../customers/store-credit'
import { STORE_CREDIT_PROVIDER } from '../payments/split-tender'
import { convertDraftForOnlinePayment, loadDraftInvoice } from './draft-pay'
import { DraftPaidByStoreCredit } from './draft-store-credit'
import { convertDraft, createDraft, type DraftInput, deleteDraft, updateDraft } from './drafts'
import { cancelOrder } from './status'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

const PRICE = 100_000

const shipping = {
  name: 'Shriram V',
  line1: '12 MG Road',
  city: 'Bengaluru',
  stateCode: 'KA',
  pincode: '560001',
  phone: '9876543210',
}

async function seed(credit: number) {
  const [s] = await owner.insert(store).values({ slug: 'w', name: 'Waimers' }).returning()
  if (!s) throw new Error('seed')
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'pad', title: 'Glasspad', status: 'active' })
    .returning()
  if (!p) throw new Error('seed')
  const [v] = await owner
    .insert(variant)
    .values({ storeId: s.id, productId: p.id, title: 'Black', pricePaise: PRICE })
    .returning()
  if (!v) throw new Error('seed')
  await owner.insert(inventoryLevel).values({ storeId: s.id, variantId: v.id, onHand: 20 })
  const [cu] = await owner
    .insert(customer)
    .values({ storeId: s.id, email: 'shriram@example.in', name: 'Shriram V' })
    .returning()
  if (!cu) throw new Error('seed')
  if (credit > 0) {
    await withStore(app, s.id, (tx) =>
      changeStoreCredit(
        { storeId: s.id, tx },
        { customerId: cu.id, amountPaise: credit, kind: 'adjustment', reason: 'Goodwill' },
      ),
    )
  }
  return { storeId: s.id, variantId: v.id, customerId: cu.id }
}

type Seeded = Awaited<ReturnType<typeof seed>>

const draftInput = (t: Seeded, over: Partial<DraftInput> = {}): DraftInput => ({
  customerId: t.customerId,
  email: 'shriram@example.in',
  shipping,
  lines: [{ variantId: t.variantId, quantity: 2 }],
  discountPaise: 0,
  shippingPaise: 0,
  ...over,
})

const inStore = <T>(t: Seeded, fn: (ctx: StoreContext) => Promise<T>) =>
  withStore(app, t.storeId, (tx) => fn({ storeId: t.storeId, tx }))

async function balanceOf(customerId: string): Promise<number> {
  const [a] = await owner
    .select({ balancePaise: storeCreditAccount.balancePaise })
    .from(storeCreditAccount)
    .where(eq(storeCreditAccount.customerId, customerId))
  return a?.balancePaise ?? 0
}

const ledger = (customerId: string) =>
  owner.select().from(storeCreditEntry).where(eq(storeCreditEntry.customerId, customerId))

const paymentsOf = (orderId: string) =>
  owner.select().from(payment).where(eq(payment.orderId, orderId))

const creditRows = (orderId: string) =>
  owner
    .select()
    .from(payment)
    .where(and(eq(payment.orderId, orderId), eq(payment.provider, STORE_CREDIT_PROVIDER)))

describe('applying store credit to a draft', () => {
  it('records it on the draft and takes nothing from the balance', async () => {
    const t = await seed(150_000)
    const d = await inStore(t, (ctx) =>
      createDraft(ctx, draftInput(t, { storeCreditPaise: 120_000 })),
    )
    expect(await balanceOf(t.customerId)).toBe(150_000)
    expect(await ledger(t.customerId)).toHaveLength(1)
    const [row] = await creditRows(d.id)
    expect(row).toMatchObject({
      status: 'created',
      amountPaise: 120_000,
      providerPaymentId: t.customerId,
    })
    // An edit that leaves it out keeps it; 0 removes it.
    await inStore(t, (ctx) => updateDraft(ctx, d.id, draftInput(t)))
    expect((await creditRows(d.id))[0]?.amountPaise).toBe(120_000)
    await inStore(t, (ctx) => updateDraft(ctx, d.id, draftInput(t, { storeCreditPaise: 0 })))
    expect(await creditRows(d.id)).toHaveLength(0)
  })

  it('refuses more than the balance, more than the total, or no customer', async () => {
    const t = await seed(50_000)
    await expect(
      inStore(t, (ctx) => createDraft(ctx, draftInput(t, { storeCreditPaise: 60_000 }))),
    ).rejects.toMatchObject({ reason: 'insufficient' })
    await owner
      .update(storeCreditAccount)
      .set({ balancePaise: 900_000 })
      .where(eq(storeCreditAccount.customerId, t.customerId))
    await expect(
      inStore(t, (ctx) => createDraft(ctx, draftInput(t, { storeCreditPaise: 200_001 }))),
    ).rejects.toBeInstanceOf(StoreCreditError)
    await expect(
      inStore(t, (ctx) =>
        createDraft(ctx, draftInput(t, { customerId: null, storeCreditPaise: 1_000 })),
      ),
    ).rejects.toThrow(/Pick a customer/)
    // A customer changed on a draft that kept its credit is refused too.
    const d = await inStore(t, (ctx) =>
      createDraft(ctx, draftInput(t, { storeCreditPaise: 10_000 })),
    )
    await expect(
      inStore(t, (ctx) => updateDraft(ctx, d.id, draftInput(t, { customerId: null }))),
    ).rejects.toThrow(/Pick a customer/)
  })
})

describe('converting a draft paid with store credit', () => {
  it('full cover: one ledger debit and a captured payment, in the same convert; paid', async () => {
    const t = await seed(250_000)
    const d = await inStore(t, (ctx) =>
      createDraft(ctx, draftInput(t, { storeCreditPaise: 2 * PRICE })),
    )
    const placed = await inStore(t, (ctx) => convertDraft(ctx, d.id))
    expect(placed).toMatchObject({ status: 'open', paymentMethod: STORE_CREDIT_PROVIDER })
    expect(placed?.paymentStatus).toBe('paid')
    expect(await balanceOf(t.customerId)).toBe(50_000)
    const debit = (await ledger(t.customerId)).find((e) => e.kind === 'payment')
    expect(debit).toMatchObject({ amountPaise: -2 * PRICE, orderId: d.id })
    const rows = await paymentsOf(d.id)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      provider: STORE_CREDIT_PROVIDER,
      status: 'captured',
      amountPaise: 2 * PRICE,
    })
  })

  it('part cover: the method collects only the rest; total and GST are unchanged', async () => {
    const t = await seed(80_000)
    const plain = await inStore(t, (ctx) => createDraft(ctx, draftInput(t)))
    const d = await inStore(t, (ctx) =>
      createDraft(ctx, draftInput(t, { storeCreditPaise: 80_000, paymentMethod: 'manual' })),
    )
    const withCredit = await inStore(t, (ctx) => convertDraft(ctx, d.id))
    const without = await inStore(t, (ctx) => convertDraft(ctx, plain.id))
    expect(withCredit?.totalPaise).toBe(without?.totalPaise)
    expect(withCredit?.taxPaise).toBe(without?.taxPaise)
    expect(withCredit?.paymentMethod).toBe('manual')
    const rows = await paymentsOf(d.id)
    expect(rows.find((p) => p.provider === STORE_CREDIT_PROVIDER)).toMatchObject({
      status: 'captured',
      amountPaise: 80_000,
    })
    expect(rows.find((p) => p.provider === 'manual')).toMatchObject({
      status: 'pending',
      amountPaise: 2 * PRICE - 80_000,
    })
    expect(await balanceOf(t.customerId)).toBe(0)
  })

  it('a balance spent elsewhere since the save refuses the convert and changes nothing', async () => {
    const t = await seed(100_000)
    const d = await inStore(t, (ctx) =>
      createDraft(ctx, draftInput(t, { storeCreditPaise: 100_000 })),
    )
    await inStore(t, (ctx) =>
      changeStoreCredit(ctx, {
        customerId: t.customerId,
        amountPaise: -30_000,
        kind: 'adjustment',
        reason: 'Spent at checkout',
      }),
    )
    await expect(inStore(t, (ctx) => convertDraft(ctx, d.id))).rejects.toMatchObject({
      reason: 'insufficient',
    })
    const [still] = await owner.select().from(order).where(eq(order.id, d.id))
    expect(still?.status).toBe('draft')
    expect(await balanceOf(t.customerId)).toBe(70_000)
    expect((await creditRows(d.id))[0]?.status).toBe('created')
  })

  it('two drafts converting at once never spend the same credit', async () => {
    const t = await seed(100_000)
    const a = await inStore(t, (ctx) =>
      createDraft(ctx, draftInput(t, { storeCreditPaise: 60_000 })),
    )
    const b = await inStore(t, (ctx) =>
      createDraft(ctx, draftInput(t, { storeCreditPaise: 60_000 })),
    )
    const results = await Promise.allSettled([
      inStore(t, (ctx) => convertDraft(ctx, a.id)),
      inStore(t, (ctx) => convertDraft(ctx, b.id)),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(await balanceOf(t.customerId)).toBe(40_000)
    const debits = (await ledger(t.customerId)).filter((e) => e.kind === 'payment')
    expect(debits).toHaveLength(1)
  })

  it('converting the same draft twice takes the credit once', async () => {
    const t = await seed(100_000)
    const d = await inStore(t, (ctx) =>
      createDraft(ctx, draftInput(t, { storeCreditPaise: 50_000 })),
    )
    const results = await Promise.allSettled([
      inStore(t, (ctx) => convertDraft(ctx, d.id)),
      inStore(t, (ctx) => convertDraft(ctx, d.id)),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(await balanceOf(t.customerId)).toBe(50_000)
    expect(await creditRows(d.id)).toHaveLength(1)
  })

  it('deleting a draft with store credit applied leaves the balance whole', async () => {
    const t = await seed(100_000)
    const d = await inStore(t, (ctx) =>
      createDraft(ctx, draftInput(t, { storeCreditPaise: 100_000 })),
    )
    expect(await inStore(t, (ctx) => deleteDraft(ctx, d.id))).toBe(true)
    expect(await balanceOf(t.customerId)).toBe(100_000)
    expect(await ledger(t.customerId)).toHaveLength(1)
    expect(await paymentsOf(d.id)).toHaveLength(0)
  })
})

describe('a draft invoice paid online with store credit', () => {
  it('holds the credit, asks the gateway for the rest, and gives it back if cancelled unpaid', async () => {
    const t = await seed(50_000)
    const d = await inStore(t, (ctx) =>
      createDraft(ctx, draftInput(t, { storeCreditPaise: 50_000 })),
    )
    const invoice = await inStore(t, (ctx) => loadDraftInvoice(ctx, d.id))
    expect(invoice).toMatchObject({ storeCreditPaise: 50_000, duePaise: 2 * PRICE - 50_000 })

    const r = await inStore(t, (ctx) => convertDraftForOnlinePayment(ctx, d.id, 'razorpay'))
    const [attempt] = await owner
      .select()
      .from(payment)
      .where(eq(payment.id, r?.attemptId ?? ''))
    expect(attempt?.amountPaise).toBe(2 * PRICE - 50_000)
    expect((await creditRows(d.id))[0]?.status).toBe('pending')
    expect(await balanceOf(t.customerId)).toBe(0)

    await inStore(t, (ctx) => cancelOrder(ctx, d.id))
    expect(await balanceOf(t.customerId)).toBe(50_000)
    expect((await ledger(t.customerId)).map((e) => e.kind)).toContain('release')
  })

  it('has nothing to pay online when store credit covers it all', async () => {
    const t = await seed(2 * PRICE)
    const d = await inStore(t, (ctx) =>
      createDraft(ctx, draftInput(t, { storeCreditPaise: 2 * PRICE })),
    )
    await expect(
      inStore(t, (ctx) => convertDraftForOnlinePayment(ctx, d.id, 'razorpay')),
    ).rejects.toBeInstanceOf(DraftPaidByStoreCredit)
    expect(await balanceOf(t.customerId)).toBe(2 * PRICE)
  })
})
