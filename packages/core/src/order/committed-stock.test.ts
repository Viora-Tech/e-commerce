import {
  createDb,
  inventoryAdjustment,
  inventoryLevel,
  location,
  order,
  orderLine,
  product,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { StoreContext } from '../context'
import { fulfilOrderLines, fulfilRemainingLines, OrderNotFulfillable } from './fulfil'
import { cancelOrder, changeOrderStatus, OrderStatusLocked } from './status'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

/**
 * An order for 3 of a tracked variant and 1 of an untracked one, placed from a
 * store with two locations: the selling one (10 on hand, 3 committed) and a
 * back room (5 on hand) that must never move.
 */
async function seed(status: 'placed' | 'paid' | 'draft' = 'paid') {
  const [s] = await owner.insert(store).values({ slug: 'waimers', name: 'Waimers' }).returning()
  if (!s) throw new Error('seed')
  const [shop, backRoom] = await owner
    .insert(location)
    .values([
      { storeId: s.id, name: 'Shop', isDefault: true, fulfilsOnlineOrders: true },
      { storeId: s.id, name: 'Back room' },
    ])
    .returning()
  if (!shop || !backRoom) throw new Error('seed')
  const [p] = await owner
    .insert(product)
    .values({ storeId: s.id, handle: 'pad', title: 'Pad' })
    .returning()
  if (!p) throw new Error('seed')
  const [tracked, untracked] = await owner
    .insert(variant)
    .values([
      { storeId: s.id, productId: p.id, title: 'Black', pricePaise: 100000 },
      {
        storeId: s.id,
        productId: p.id,
        title: 'Custom',
        pricePaise: 100000,
        trackInventory: false,
      },
    ])
    .returning()
  if (!tracked || !untracked) throw new Error('seed')
  await owner.insert(inventoryLevel).values([
    {
      storeId: s.id,
      variantId: tracked.id,
      locationId: shop.id,
      onHand: 10,
      reserved: status === 'draft' ? 0 : 3,
    },
    {
      storeId: s.id,
      variantId: tracked.id,
      locationId: backRoom.id,
      onHand: 5,
      fulfilsOnline: false,
    },
  ])
  const [o] = await owner
    .insert(order)
    .values({ storeId: s.id, number: 1, status, subtotalPaise: 400000, totalPaise: 400000 })
    .returning()
  if (!o) throw new Error('seed')
  const [line, custom] = await owner
    .insert(orderLine)
    .values([
      { storeId: s.id, orderId: o.id, variantId: tracked.id, quantity: 3, unitPricePaise: 100000 },
      {
        storeId: s.id,
        orderId: o.id,
        variantId: untracked.id,
        quantity: 1,
        unitPricePaise: 100000,
      },
    ])
    .returning()
  if (!line || !custom) throw new Error('seed')
  return { storeId: s.id, orderId: o.id, line, custom, variantId: tracked.id, shop, backRoom }
}

type Seeded = Awaited<ReturnType<typeof seed>>

async function levels(t: Seeded) {
  const rows = await owner
    .select()
    .from(inventoryLevel)
    .where(eq(inventoryLevel.variantId, t.variantId))
  const at = (id: string) => rows.find((r) => r.locationId === id)
  return {
    shop: { onHand: at(t.shop.id)?.onHand, committed: at(t.shop.id)?.reserved },
    backRoom: { onHand: at(t.backRoom.id)?.onHand, committed: at(t.backRoom.id)?.reserved },
  }
}

function inStore<T>(t: Seeded, fn: (ctx: StoreContext) => Promise<T>) {
  return withStore(app, t.storeId, (tx) => fn({ tx, storeId: t.storeId }))
}

describe('committed stock on fulfilment', () => {
  it('packing drops on hand and committed together at the selling location only', async () => {
    const t = await seed()
    await inStore(t, (ctx) =>
      fulfilOrderLines(ctx, { orderId: t.orderId, lines: [{ lineId: t.line.id, quantity: 2 }] }),
    )
    expect(await levels(t)).toEqual({
      shop: { onHand: 8, committed: 1 },
      backRoom: { onHand: 5, committed: 0 },
    })
    const log = await owner
      .select()
      .from(inventoryAdjustment)
      .where(eq(inventoryAdjustment.variantId, t.variantId))
    expect(log).toEqual([
      expect.objectContaining({ delta: -2, reason: 'sold', locationId: t.shop.id }),
    ])
  })

  it('a repeated pack past the ordered quantity is refused and moves nothing', async () => {
    const t = await seed()
    const pack = () =>
      inStore(t, (ctx) =>
        fulfilOrderLines(ctx, { orderId: t.orderId, lines: [{ lineId: t.line.id, quantity: 3 }] }),
      )
    await pack()
    await expect(pack()).rejects.toThrow()
    expect((await levels(t)).shop).toEqual({ onHand: 7, committed: 0 })
  })

  it('refuses the same line listed twice past its quantity', async () => {
    const t = await seed()
    await expect(
      inStore(t, (ctx) =>
        fulfilOrderLines(ctx, {
          orderId: t.orderId,
          lines: [
            { lineId: t.line.id, quantity: 2 },
            { lineId: t.line.id, quantity: 2 },
          ],
        }),
      ),
    ).rejects.toThrow()
    expect((await levels(t)).shop).toEqual({ onHand: 10, committed: 3 })
  })

  it('packing the rest (courier booking, status fulfilled) is idempotent', async () => {
    const t = await seed()
    await inStore(t, (ctx) =>
      fulfilOrderLines(ctx, { orderId: t.orderId, lines: [{ lineId: t.line.id, quantity: 1 }] }),
    )
    await inStore(t, (ctx) => fulfilRemainingLines(ctx, t.orderId))
    await inStore(t, (ctx) => fulfilRemainingLines(ctx, t.orderId))
    await inStore(t, (ctx) => changeOrderStatus(ctx, t.orderId, 'fulfilled'))
    expect((await levels(t)).shop).toEqual({ onHand: 7, committed: 0 })
    const lines = await owner.select().from(orderLine).where(eq(orderLine.orderId, t.orderId))
    expect(lines.every((l) => l.fulfilledQuantity === l.quantity)).toBe(true)
  })

  it('status fulfilled packs every unpacked unit', async () => {
    const t = await seed()
    const o = await inStore(t, (ctx) => changeOrderStatus(ctx, t.orderId, 'fulfilled'))
    expect(o?.status).toBe('fulfilled')
    expect((await levels(t)).shop).toEqual({ onHand: 7, committed: 0 })
  })
})

describe('committed stock on cancel', () => {
  it('releases committed for unpacked units only and leaves on hand alone', async () => {
    const t = await seed()
    await inStore(t, (ctx) =>
      fulfilOrderLines(ctx, { orderId: t.orderId, lines: [{ lineId: t.line.id, quantity: 1 }] }),
    )
    await inStore(t, (ctx) => changeOrderStatus(ctx, t.orderId, 'cancelled'))
    expect(await levels(t)).toEqual({
      shop: { onHand: 9, committed: 0 },
      backRoom: { onHand: 5, committed: 0 },
    })
  })

  it('a repeated cancel releases nothing more', async () => {
    const t = await seed()
    // Another open order holds 2 more on the same row; a double release would eat into it.
    await owner
      .update(inventoryLevel)
      .set({ reserved: 5 })
      .where(
        and(eq(inventoryLevel.variantId, t.variantId), eq(inventoryLevel.locationId, t.shop.id)),
      )
    await inStore(t, (ctx) => cancelOrder(ctx, t.orderId))
    const again = await inStore(t, (ctx) => cancelOrder(ctx, t.orderId))
    await inStore(t, (ctx) => changeOrderStatus(ctx, t.orderId, 'cancelled'))
    expect(again?.status).toBe('cancelled')
    expect((await levels(t)).shop).toEqual({ onHand: 10, committed: 2 })
  })

  it('a cancelled order can be neither packed nor reopened', async () => {
    const t = await seed()
    await inStore(t, (ctx) => cancelOrder(ctx, t.orderId))
    await expect(
      inStore(t, (ctx) =>
        fulfilOrderLines(ctx, { orderId: t.orderId, lines: [{ lineId: t.line.id, quantity: 1 }] }),
      ),
    ).rejects.toBeInstanceOf(OrderNotFulfillable)
    await expect(
      inStore(t, (ctx) => changeOrderStatus(ctx, t.orderId, 'placed')),
    ).rejects.toBeInstanceOf(OrderStatusLocked)
    await inStore(t, (ctx) => fulfilRemainingLines(ctx, t.orderId))
    expect((await levels(t)).shop).toEqual({ onHand: 10, committed: 0 })
  })

  it('a draft holds nothing, so it cannot be cancelled or packed through here', async () => {
    const t = await seed('draft')
    await expect(inStore(t, (ctx) => cancelOrder(ctx, t.orderId))).rejects.toBeInstanceOf(
      OrderStatusLocked,
    )
    await expect(
      inStore(t, (ctx) => changeOrderStatus(ctx, t.orderId, 'fulfilled')),
    ).rejects.toBeInstanceOf(OrderStatusLocked)
    expect((await levels(t)).shop).toEqual({ onHand: 10, committed: 0 })
  })

  it('an unknown order is null', async () => {
    const t = await seed()
    const missing = '00000000-0000-4000-8000-000000000000'
    expect(await inStore(t, (ctx) => changeOrderStatus(ctx, missing, 'paid'))).toBeNull()
    expect(await inStore(t, (ctx) => cancelOrder(ctx, missing))).toBeNull()
  })
})
