/** SOURCE OF TRUTH: draft invoice page tests — WHAT: loadDraftInvoice and draftInvoiceState read a draft's lines, total and payability / WHY: the storefront's signed invoice link decides from these whether to show Pay or the thank-you page */
import { createDb, inventoryLevel, order, product, store, variant, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { draftInvoiceState, loadDraftInvoice } from './draft-pay'
import { createDraft } from './drafts'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

async function seedDraft() {
  const [s] = await owner.insert(store).values({ slug: 'w', name: 'Waimers' }).returning()
  if (!s) throw new Error('seed')
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'pad', title: 'Glasspad', status: 'active' })
    .returning()
  if (!p) throw new Error('seed')
  const [v] = await owner
    .insert(variant)
    .values({ storeId: s.id, productId: p.id, title: 'Black', pricePaise: 100000 })
    .returning()
  if (!v) throw new Error('seed')
  await owner.insert(inventoryLevel).values({ storeId: s.id, variantId: v.id, onHand: 5 })
  const draft = await withStore(app, s.id, (tx) =>
    createDraft(
      { storeId: s.id, tx },
      {
        email: 'a@example.in',
        lines: [{ variantId: v.id, quantity: 2 }],
        discountPaise: 0,
        shippingPaise: 0,
      },
    ),
  )
  return { storeId: s.id, orderId: draft.id }
}

describe('draft invoice page', () => {
  it('shows a draft with its lines, total and store name, and as payable', async () => {
    const { storeId, orderId } = await seedDraft()
    const invoice = await withStore(app, storeId, (tx) =>
      loadDraftInvoice({ storeId, tx }, orderId),
    )
    expect(invoice).toMatchObject({
      id: orderId,
      totalPaise: 200000,
      payable: true,
      storeName: 'Waimers',
    })
    expect(invoice?.lines).toEqual([
      expect.objectContaining({
        title: 'Glasspad',
        variant: 'Black',
        quantity: 2,
        unitPricePaise: 100000,
      }),
    ])
    const state = await withStore(app, storeId, (tx) => draftInvoiceState({ storeId, tx }, orderId))
    expect(state).toMatchObject({ status: 'draft', payable: true })
  })

  it('is no longer payable once the order is paid or cancelled', async () => {
    const { storeId, orderId } = await seedDraft()
    const stateOf = () =>
      withStore(app, storeId, (tx) => draftInvoiceState({ storeId, tx }, orderId))

    await owner.update(order).set({ status: 'open' }).where(eq(order.id, orderId))
    expect((await stateOf())?.payable).toBe(true)

    await owner.update(order).set({ checkoutPaidAt: new Date() }).where(eq(order.id, orderId))
    expect((await stateOf())?.payable).toBe(false)

    await owner
      .update(order)
      .set({ status: 'cancelled', checkoutPaidAt: null })
      .where(eq(order.id, orderId))
    expect((await stateOf())?.payable).toBe(false)
  })

  it('reads nothing for an order that is gone', async () => {
    const { storeId } = await seedDraft()
    const missing = '00000000-0000-7000-8000-000000000000'
    expect(
      await withStore(app, storeId, (tx) => loadDraftInvoice({ storeId, tx }, missing)),
    ).toBeNull()
    expect(
      await withStore(app, storeId, (tx) => draftInvoiceState({ storeId, tx }, missing)),
    ).toBeNull()
  })
})
