/** SOURCE OF TRUTH: Automations trigger emitter tests — WHAT: the outbox rows the new triggers listen to are written where the change happens: product created / updated (not by imports), customer tags changed (with the diff), customer subscribed (a fresh email or WhatsApp opt in, not an import), stock low / out (once per product per crossing, from stock edits and order reservations) / WHY: a missing emitter means a trigger that silently never fires. */
import {
  createDb,
  customer,
  inventoryLevel,
  location,
  outboxEvent,
  type StoreTx,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createProduct, updateProduct } from '../catalog/products'
import { noteCustomerTagsChanged } from '../customers/changes'
import { adjustStock } from '../inventory/levels'
import { routeAndReserve } from '../order/routing-service'
import { setMarketingConsent } from '../privacy/marketing-consent'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

async function inStore<T>(fn: (tx: StoreTx, storeId: string) => Promise<T>): Promise<T> {
  const [s] = await owner
    .insert(store)
    .values({ slug: 'emit', name: 'Chai Co', lowStockThreshold: 5 })
    .returning()
  return withStore(app, s?.id as string, (tx) => fn(tx, s?.id as string))
}

const events = async (tx: StoreTx, type: string) =>
  (await tx.select().from(outboxEvent).where(eq(outboxEvent.type, type))).map((e) => e.payload)

const tea = {
  title: 'Tea',
  status: 'active' as const,
  options: [],
  variants: [{ optionValues: [], pricePaise: 10_000 }],
}

describe('product events', () => {
  it('writes product.created and product.updated, and nothing for imports', async () => {
    await inStore(async (tx, storeId) => {
      const id = await createProduct(tx, storeId, tea)
      await updateProduct(tx, storeId, id, { ...tea, title: 'Masala tea' })
      expect(await events(tx, 'product.created')).toEqual([{ productId: id }])
      expect(await events(tx, 'product.updated')).toEqual([{ productId: id }])
      const imported = await createProduct(tx, storeId, tea, { imported: true })
      await updateProduct(tx, storeId, imported, tea, { imported: true })
      expect(await events(tx, 'product.created')).toHaveLength(1)
      expect(await events(tx, 'product.updated')).toHaveLength(1)
    })
  })
})

describe('customer events', () => {
  it('writes the tag diff only when tags change', async () => {
    await inStore(async (tx, storeId) => {
      const [c] = await tx.insert(customer).values({ storeId, email: 'a@x.in' }).returning()
      const id = c?.id as string
      await noteCustomerTagsChanged(tx, storeId, id, ['VIP', 'old'], ['vip', 'new'])
      await noteCustomerTagsChanged(tx, storeId, id, ['vip'], ['VIP'])
      expect(await events(tx, 'customer.tags_changed')).toEqual([
        { customerId: id, tagsAdded: ['new'], tagsRemoved: ['old'] },
      ])
    })
  })

  it('writes customer.subscribed on a fresh email or WhatsApp opt in, not for SMS or imports', async () => {
    await inStore(async (tx, storeId) => {
      const [c] = await tx.insert(customer).values({ storeId, email: 'a@x.in' }).returning()
      const customerId = c?.id as string
      const ctx = { tx, storeId }
      const grant = (channel: 'email' | 'whatsapp' | 'sms', source: 'checkout' | 'import') =>
        setMarketingConsent(ctx, {
          customerId,
          channel,
          granted: true,
          source,
          actor: { type: 'customer' },
        })
      await grant('sms', 'checkout')
      await grant('whatsapp', 'import')
      expect(await events(tx, 'customer.subscribed')).toHaveLength(0)
      await grant('email', 'checkout')
      await grant('email', 'checkout') // already on: nothing changes
      expect(await events(tx, 'customer.subscribed')).toEqual([{ customerId }])
    })
  })
})

describe('stock crossings', () => {
  async function stocked(tx: StoreTx, storeId: string, onHand: number) {
    const [loc] = await tx
      .insert(location)
      .values({ storeId, name: 'Main', isDefault: true, fulfilsOnlineOrders: true })
      .returning()
    const productId = await createProduct(tx, storeId, {
      ...tea,
      variants: [{ optionValues: [], pricePaise: 10_000 }],
    })
    const [v] = await tx.select().from(variant).where(eq(variant.productId, productId))
    await tx.delete(inventoryLevel).where(eq(inventoryLevel.variantId, v?.id as string))
    await tx.insert(inventoryLevel).values({
      storeId,
      variantId: v?.id as string,
      locationId: loc?.id as string,
      onHand,
    })
    return { productId, variantId: v?.id as string, locationId: loc?.id as string }
  }

  it('writes inventory.low and inventory.out once per crossing from stock edits', async () => {
    await inStore(async (tx, storeId) => {
      const s = await stocked(tx, storeId, 10)
      const adjust = (delta: number) =>
        adjustStock(tx, {
          storeId,
          variantId: s.variantId,
          locationId: s.locationId,
          delta,
          reason: 'correction',
        })
      await adjust(-4) // 6: still above 5
      expect(await events(tx, 'inventory.low')).toHaveLength(0)
      await adjust(-2) // 4: crossed to low
      await adjust(-1) // 3: still low, no new event
      expect(await events(tx, 'inventory.low')).toEqual([
        { productId: s.productId, variantId: s.variantId },
      ])
      await adjust(-3) // 0: out
      await adjust(5) // back to 5 (low, but rising)
      expect(await events(tx, 'inventory.out')).toHaveLength(1)
      expect(await events(tx, 'inventory.low')).toHaveLength(1)
      await adjust(10) // 15
      await adjust(-11) // 4: a new crossing
      expect(await events(tx, 'inventory.low')).toHaveLength(2)
    })
  })

  it('an order reservation that takes the last units writes inventory.out', async () => {
    await inStore(async (tx, storeId) => {
      const s = await stocked(tx, storeId, 2)
      await routeAndReserve(
        { tx, storeId },
        {
          lines: [
            { key: 'l1', variantId: s.variantId, quantity: 2, giftCard: false, preorder: null },
          ],
          buyerState: null,
        },
      )
      expect(await events(tx, 'inventory.out')).toEqual([
        { productId: s.productId, variantId: s.variantId },
      ])
    })
  })
})
