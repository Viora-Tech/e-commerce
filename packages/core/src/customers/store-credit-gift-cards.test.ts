/** SOURCE OF TRUTH: old store-credit gift card move tests — WHAT: which cards are listed and ticked, moving one onto its customer's balance (found or made by email, never without one), the card emptied and disabled with a history line, its expiry kept, and a second run or a concurrent one never crediting twice / WHY: this moves real money between two records, so it must happen exactly once */
import {
  createDb,
  customer,
  giftCard,
  giftCardTransaction,
  store,
  storeCreditEntry,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { storeCreditOf } from './store-credit'
import {
  moveGiftCardsToStoreCredit,
  moveGiftCardToStoreCredit,
  storeCreditGiftCards,
} from './store-credit-gift-cards'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)
const SECRET = 'test-secret-test-secret-test-secret'

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

const inStore = <T>(storeId: string, fn: Parameters<typeof withStore<T>>[2]) =>
  withStore(app, storeId, fn)

let n = 0
async function card(
  storeId: string,
  values: Partial<typeof giftCard.$inferInsert> & { balancePaise: number },
) {
  n += 1
  const [row] = await owner
    .insert(giftCard)
    .values({
      storeId,
      codeHash: `hash-${n}`,
      lastCharacters: `G${String(n).padStart(3, '0')}`,
      initialValuePaise: values.balancePaise,
      ...values,
    })
    .returning()
  if (!row) throw new Error('seed')
  return row
}

async function seed() {
  const [s] = await owner.insert(store).values({ slug: 'w', name: 'Waimers' }).returning()
  if (!s) throw new Error('seed')
  const [cu] = await owner
    .insert(customer)
    .values({ storeId: s.id, email: 'shriram@example.com', name: 'Shriram V' })
    .returning()
  if (!cu) throw new Error('seed')
  return { storeId: s.id, customerId: cu.id }
}

describe('old store-credit gift cards → balance', () => {
  it('lists refund cards (ticked) and Shopify cards (ticked only when they say store credit)', async () => {
    const { storeId, customerId } = await seed()
    const refundCard = await card(storeId, {
      balancePaise: 190_000,
      customerId,
      note: 'Store credit refund for order #2424',
    })
    const shopify = await card(storeId, {
      balancePaise: 50_000,
      recipientEmail: 'new@example.com',
      createdBy: 'Shopify import',
      note: 'Imported from Shopify gift card ending ABCD (issued at ₹500.00).',
    })
    const shopifyRefund = await card(storeId, {
      balancePaise: 20_000,
      createdBy: 'Shopify import',
      note: 'Imported from Shopify gift card ending WXYZ. Refund for #1001',
    })
    // Not listed: bought at checkout, a plain manual card, used up, disabled.
    await card(storeId, { balancePaise: 10_000, source: 'purchase', note: 'Store credit refund for order #1' })
    await card(storeId, { balancePaise: 10_000, note: 'Birthday' })
    await card(storeId, { balancePaise: 0, note: 'Store credit refund for order #2' })
    await card(storeId, {
      balancePaise: 5_000,
      note: 'Store credit for return R-3 (order #9)',
      disabledAt: new Date(),
    })
    const list = await inStore(storeId, (tx) => storeCreditGiftCards({ storeId, tx }))
    expect(list.map((c) => [c.id, c.origin, c.suggested, c.problem])).toEqual([
      [refundCard.id, 'refund', true, null],
      [shopify.id, 'shopify', false, null],
      [shopifyRefund.id, 'shopify', true, 'no_customer'],
    ])
  })

  it('moves the value left onto the balance, empties and disables the card, once', async () => {
    const { storeId, customerId } = await seed()
    const c = await card(storeId, {
      balancePaise: 190_000,
      customerId,
      note: 'Store credit refund for order #2424',
    })
    const staff = { userId: 'u1', email: 'owner@waimers.in' }
    const first = await inStore(storeId, (tx) =>
      moveGiftCardToStoreCredit({ storeId, tx }, { giftCardId: c.id, secret: SECRET, staff }),
    )
    expect(first).toMatchObject({ status: 'moved', customerId, amountPaise: 190_000 })
    const again = await inStore(storeId, (tx) =>
      moveGiftCardsToStoreCredit({ storeId, tx }, { giftCardIds: [c.id, c.id], secret: SECRET }),
    )
    expect(again).toEqual([
      { giftCardId: c.id, status: 'already_moved', customerId, amountPaise: 190_000 },
    ])
    const account = await inStore(storeId, (tx) => storeCreditOf({ storeId, tx }, customerId))
    expect(account.balancePaise).toBe(190_000)
    expect(account.entries.map((e) => [e.amountPaise, e.reason, e.staffEmail])).toEqual([
      [190_000, `Moved from gift card ending ${c.lastCharacters}`, 'owner@waimers.in'],
    ])
    const [after] = await owner.select().from(giftCard).where(eq(giftCard.id, c.id))
    expect(after?.balancePaise).toBe(0)
    expect(after?.disabledAt).not.toBeNull()
    const history = await owner
      .select()
      .from(giftCardTransaction)
      .where(eq(giftCardTransaction.giftCardId, c.id))
    expect(history.some((h) => h.amountPaise === -190_000)).toBe(true)
  })

  it('two moves at once credit the balance once', async () => {
    const { storeId, customerId } = await seed()
    const c = await card(storeId, { balancePaise: 70_000, customerId, note: 'Store credit refund for order #5' })
    const runs = await Promise.allSettled(
      [1, 2].map(() =>
        inStore(storeId, (tx) =>
          moveGiftCardToStoreCredit({ storeId, tx }, { giftCardId: c.id, secret: SECRET }),
        ),
      ),
    )
    expect(runs.map((r) => r.status === 'fulfilled' && r.value.status).sort()).toEqual([
      'already_moved',
      'moved',
    ])
    const lines = await owner.select().from(storeCreditEntry).where(eq(storeCreditEntry.giftCardId, c.id))
    expect(lines).toHaveLength(1)
    const account = await inStore(storeId, (tx) => storeCreditOf({ storeId, tx }, customerId))
    expect(account.balancePaise).toBe(70_000)
  })

  it('finds or makes the customer by email, keeps the expiry, and never moves a card with nobody', async () => {
    const { storeId, customerId } = await seed()
    const byEmail = await card(storeId, {
      balancePaise: 30_000,
      recipientEmail: 'shriram@example.com',
      createdBy: 'Shopify import',
      expiresOn: '2099-12-31',
    })
    const newPerson = await card(storeId, {
      balancePaise: 15_000,
      recipientEmail: 'new@example.com',
      createdBy: 'Shopify import',
    })
    const nobody = await card(storeId, { balancePaise: 9_000, createdBy: 'Shopify import' })
    const results = await inStore(storeId, (tx) =>
      moveGiftCardsToStoreCredit(
        { storeId, tx },
        { giftCardIds: [byEmail.id, newPerson.id, nobody.id], secret: SECRET },
      ),
    )
    expect(results.map((r) => r.status)).toEqual(['moved', 'moved', 'skipped'])
    expect(results[0]).toMatchObject({ customerId })
    expect(results[2]).toMatchObject({ reason: 'no_customer' })
    const made = results[1]?.status === 'moved' ? results[1].customerId : ''
    expect(made).not.toBe(customerId)
    const account = await inStore(storeId, (tx) => storeCreditOf({ storeId, tx }, customerId))
    expect(account.entries[0]?.expiresOn).toBe('2099-12-31')
    // The card with nobody to hold it is untouched.
    const [left] = await owner.select().from(giftCard).where(eq(giftCard.id, nobody.id))
    expect(left?.balancePaise).toBe(9_000)
    expect(left?.disabledAt).toBeNull()
  })
})
