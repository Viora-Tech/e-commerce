/** SOURCE OF TRUTH: customer merge — tests mergeCustomers (orders, addresses, store credit sums and expiry, sign-ins, consent, the stub left behind) and its refusals */
import {
  createDb,
  customer,
  customerAddress,
  customerIdentity,
  customerNote,
  customerSession,
  marketingConsentEvent,
  order,
  privacyAuditEvent,
  product,
  productView,
  store,
  storeCreditAccount,
  storeCreditEntry,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { asc, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { mergeCustomers, previewCustomerMerge } from './merge'
import { changeStoreCredit, storeCreditOf } from './store-credit'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const actor = { type: 'staff' as const, id: 'u1', label: 'Owner' }

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

async function seed() {
  const [s] = await owner.insert(store).values({ slug: 'm', name: 'm' }).returning()
  const storeId = s?.id as string
  const [kept, merged] = await owner
    .insert(customer)
    .values([
      {
        storeId,
        name: 'Jazvir Vora',
        email: 'vorajazvir@gmail.com',
        tags: ['vip'],
        note: 'Signed in with Google',
      },
      {
        storeId,
        name: 'Rudra',
        email: 'valorantrudrra@gmail.com',
        phone: '9876543210',
        tags: ['VIP', 'wholesale'],
        acceptsMarketing: true,
      },
    ])
    .returning()
  const keptId = kept?.id as string
  const mergedId = merged?.id as string
  await owner.insert(order).values([
    {
      storeId,
      number: 2445,
      customerId: mergedId,
      email: 'vorajazvir@gmail.com',
      status: 'open',
      subtotalPaise: 100000,
      totalPaise: 100000,
    },
    {
      storeId,
      number: 2446,
      customerId: mergedId,
      email: 'valorantrudrra@gmail.com',
      status: 'open',
      subtotalPaise: 50000,
      totalPaise: 50000,
    },
  ])
  const addr = {
    storeId,
    line1: '1 MG Road',
    city: 'Pune',
    stateCode: 'MH',
    pincode: '411001',
    phone: '9876543210',
  }
  await owner.insert(customerAddress).values([
    { ...addr, customerId: keptId, name: 'Jazvir', isDefault: true },
    { ...addr, customerId: mergedId, name: 'Rudra', isDefault: true, isDefaultBilling: true },
  ])
  await owner.insert(customerIdentity).values({
    storeId,
    customerId: mergedId,
    provider: 'google',
    subject: 'g-123',
  })
  await owner.insert(customerSession).values({
    storeId,
    customerId: mergedId,
    tokenHash: 'merged-session',
    expiresAt: new Date(Date.now() + 86_400_000),
  })
  return { storeId, keptId, mergedId }
}

const run = <T>(storeId: string, fn: (ctx: { storeId: string; tx: never }) => Promise<T>) =>
  withStore(app, storeId, (tx) => fn({ storeId, tx: tx as never }))

describe('mergeCustomers', () => {
  it('moves orders, addresses, sign-ins and store credit onto the kept customer', async () => {
    const { storeId, keptId, mergedId } = await seed()
    const later = new Date(Date.now() + 30 * 86_400_000)
    await run(storeId, async (ctx) => {
      await changeStoreCredit(ctx, {
        customerId: keptId,
        amountPaise: 10_000,
        kind: 'adjustment',
        reason: 'Goodwill',
      })
      await changeStoreCredit(ctx, {
        customerId: mergedId,
        amountPaise: 25_000,
        kind: 'adjustment',
        reason: 'Refund',
      })
      await changeStoreCredit(ctx, {
        customerId: mergedId,
        amountPaise: 5_000,
        kind: 'adjustment',
        reason: 'Diwali',
        expiresAt: later,
      })
      await changeStoreCredit(ctx, {
        customerId: mergedId,
        amountPaise: -2_000,
        kind: 'payment',
        reason: 'Paid',
      })
    })

    const preview = await run(storeId, (ctx) => previewCustomerMerge(ctx, keptId, mergedId))
    expect(preview.ok && preview.moves).toMatchObject({
      orders: 2,
      addresses: 1,
      identities: 1,
      storeCreditPaise: 28_000,
    })

    const result = await run(storeId, (ctx) =>
      mergeCustomers(ctx, {
        keepId: keptId,
        mergeId: mergedId,
        keep: { phone: 'merged' },
        actor,
        author: 'owner@shop.in',
      }),
    )
    expect(result.ok).toBe(true)

    const orders = await owner.select().from(order).orderBy(asc(order.number))
    expect(orders.map((o) => o.customerId)).toEqual([keptId, keptId])

    const book = await owner
      .select()
      .from(customerAddress)
      .where(eq(customerAddress.customerId, keptId))
    expect(book).toHaveLength(2)
    // The kept customer's default stays the only default.
    expect(book.filter((a) => a.isDefault).map((a) => a.name)).toEqual(['Jazvir'])
    // Nobody had a default billing address on the kept side, so theirs stays.
    expect(book.filter((a) => a.isDefaultBilling).map((a) => a.name)).toEqual(['Rudra'])

    const [identity] = await owner.select().from(customerIdentity)
    expect(identity?.customerId).toBe(keptId)
    expect(await owner.select().from(customerSession)).toHaveLength(0)

    // 100 + 280 = 380 rupees, the expiring part still expiring on its date.
    const credit = await run(storeId, (ctx) => storeCreditOf(ctx, keptId))
    expect(credit.balancePaise).toBe(38_000)
    const [account] = await owner
      .select()
      .from(storeCreditAccount)
      .where(eq(storeCreditAccount.customerId, mergedId))
    expect(account?.balancePaise).toBe(0)
    const movedIn = await owner
      .select()
      .from(storeCreditEntry)
      .where(eq(storeCreditEntry.customerId, keptId))
      .orderBy(asc(storeCreditEntry.id))
    expect(movedIn.slice(1).map((e) => [e.amountPaise, e.expiresAt?.getTime() ?? null])).toEqual([
      // The ₹20 payment spent the soonest-to-expire credit first: ₹30 of it is left.
      [3_000, later.getTime()],
      [25_000, null],
    ])

    const [k] = await owner.select().from(customer).where(eq(customer.id, keptId))
    expect(k?.email).toBe('vorajazvir@gmail.com')
    expect(k?.phone).toBe('9876543210')
    expect(k?.name).toBe('Jazvir Vora')
    expect(k?.tags).toEqual(['vip', 'wholesale'])
    const [m] = await owner.select().from(customer).where(eq(customer.id, mergedId))
    expect(m?.mergedIntoId).toBe(keptId)
    expect(m?.anonymisedAt).not.toBeNull()
    expect(m?.email).toBeNull()

    const keptNotes = await owner
      .select()
      .from(customerNote)
      .where(eq(customerNote.customerId, keptId))
    expect(keptNotes.map((n) => n.body)).toEqual([
      'Merged with Rudra: 2 orders, 1 address, ₹280.00 store credit moved here',
    ])
    const audit = await owner.select().from(privacyAuditEvent)
    expect(audit.filter((a) => a.action === 'customer.merged')).toHaveLength(2)
  })

  it('can keep the merged email, which frees it on the other record first', async () => {
    const { storeId, keptId, mergedId } = await seed()
    const result = await run(storeId, (ctx) =>
      mergeCustomers(ctx, { keepId: keptId, mergeId: mergedId, keep: { email: 'merged' }, actor }),
    )
    expect(result.ok).toBe(true)
    const [k] = await owner.select().from(customer).where(eq(customer.id, keptId))
    expect(k?.email).toBe('valorantrudrra@gmail.com')
  })

  it('takes the latest consent choice per channel and keeps both histories', async () => {
    const { storeId, keptId, mergedId } = await seed()
    await owner.insert(marketingConsentEvent).values([
      {
        storeId,
        customerId: keptId,
        channel: 'email',
        granted: false,
        source: 'account',
        actorType: 'customer',
        createdAt: new Date('2026-01-01'),
      },
      {
        storeId,
        customerId: mergedId,
        channel: 'email',
        granted: true,
        source: 'checkout',
        actorType: 'customer',
        createdAt: new Date('2026-06-01'),
      },
    ])
    await run(storeId, (ctx) => mergeCustomers(ctx, { keepId: keptId, mergeId: mergedId, actor }))
    const [k] = await owner.select().from(customer).where(eq(customer.id, keptId))
    expect(k?.acceptsMarketing).toBe(true)
    const history = await owner
      .select()
      .from(marketingConsentEvent)
      .where(eq(marketingConsentEvent.customerId, keptId))
    expect(history).toHaveLength(2)
  })

  it('keeps one browse row per product', async () => {
    const { storeId, keptId, mergedId } = await seed()
    const [p] = await owner
      .insert(product)
      .values({ storeId, title: 'Tee', handle: 'tee' })
      .returning()
    await owner.insert(productView).values([
      { storeId, customerId: keptId, productId: p?.id as string },
      { storeId, customerId: mergedId, productId: p?.id as string },
    ])
    await run(storeId, (ctx) => mergeCustomers(ctx, { keepId: keptId, mergeId: mergedId, actor }))
    const views = await owner.select().from(productView)
    expect(views.map((v) => v.customerId)).toEqual([keptId])
  })

  it('refuses the same customer, an erased one, and a second merge of the same record', async () => {
    const { storeId, keptId, mergedId } = await seed()
    const same = await run(storeId, (ctx) =>
      mergeCustomers(ctx, { keepId: keptId, mergeId: keptId, actor }),
    )
    expect(same).toEqual({ ok: false, reason: 'same' })

    const first = await run(storeId, (ctx) =>
      mergeCustomers(ctx, { keepId: keptId, mergeId: mergedId, actor }),
    )
    expect(first.ok).toBe(true)
    // Again (a double click): the stub is merged already, nothing moves twice.
    const again = await run(storeId, (ctx) =>
      mergeCustomers(ctx, { keepId: keptId, mergeId: mergedId, actor }),
    )
    expect(again).toEqual({ ok: false, reason: 'anonymised' })
    const intoStub = await run(storeId, (ctx) =>
      mergeCustomers(ctx, { keepId: mergedId, mergeId: keptId, actor }),
    )
    expect(intoStub).toEqual({ ok: false, reason: 'anonymised' })

    const [erased] = await owner
      .insert(customer)
      .values({ storeId, email: null, anonymisedAt: new Date() })
      .returning()
    const withErased = await run(storeId, (ctx) =>
      mergeCustomers(ctx, { keepId: keptId, mergeId: erased?.id as string, actor }),
    )
    expect(withErased).toEqual({ ok: false, reason: 'anonymised' })
  })

  it('does not see another store’s customer', async () => {
    const { storeId, keptId } = await seed()
    const [other] = await owner.insert(store).values({ slug: 'o', name: 'o' }).returning()
    const [stranger] = await owner
      .insert(customer)
      .values({ storeId: other?.id as string, email: 'x@o.in' })
      .returning()
    const result = await run(storeId, (ctx) =>
      mergeCustomers(ctx, { keepId: keptId, mergeId: stranger?.id as string, actor }),
    )
    expect(result).toEqual({ ok: false, reason: 'not_found' })
  })
})
